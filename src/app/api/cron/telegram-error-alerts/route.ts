import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import TelegramBot from "node-telegram-bot-api";
import * as chains from "viem/chains";
import moment from "moment";
import { Order } from "@/lib/types";
import { getSpotConfig } from "@/lib/api";
import { getSpotPartnerConfig } from "@/lib/twap";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SINK_API_URL = "https://order-sink.orbs.network";
const EXPLORER_BASE = "https://orbs-explorer.vercel.app";
const PAGE_LIMIT = 400;
const REDIS_KEY = "telegram:seen:chunk-errors";
const TELEGRAM_DELAY_MS = 1_000;
const MAX_EXTRA_TITLE_LENGTH = 200;
const FILTERED_TITLES = ["swap output insufficient"];

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

const chainNameMap: Record<number, string> = {};
for (const chain of Object.values(chains)) {
  if (chain && typeof chain === "object" && "id" in chain && "name" in chain) {
    chainNameMap[chain.id as number] = chain.name as string;
  }
}

function getChainName(chainId: number): string {
  return chainNameMap[chainId] ?? `Chain ${chainId}`;
}

// ---------------------------------------------------------------------------
// Deduplication (Upstash Redis)
// ---------------------------------------------------------------------------

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

async function loadSeenKeys(): Promise<Set<string>> {
  const redis = getRedis();
  const members = await redis.smembers(REDIS_KEY);
  return new Set(members);
}

async function markSeen(key: string): Promise<void> {
  const redis = getRedis();
  await redis.sadd(REDIS_KEY, key);
}

// ---------------------------------------------------------------------------
// Order-sink API
// ---------------------------------------------------------------------------

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(
    `${SINK_API_URL}/orders?page=0&limit=${PAGE_LIMIT}`
  );
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = (await res.json()) as { orders?: unknown[] };
  return (data.orders ?? []) as Order[];
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTelegramBot(): TelegramBot {
  return new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
}

async function sendTelegram(text: string): Promise<void> {
  const bot = getTelegramBot();
  const chatId = process.env.TELEGRAM_CHAT_ID!;
  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function isFilteredTitle(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return FILTERED_TITLES.some((f) => lower.includes(f));
}

function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set" },
      { status: 500 }
    );
  }

  try {
    const [allOrders, spotConfig, seenKeys] = await Promise.all([
      fetchOrders(),
      getSpotConfig(),
      loadSeenKeys(),
    ]);

    let sent = 0;
    let errorChunksTotal = 0;

    const sortedOrders = allOrders.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const order of sortedOrders) {
      if (!order.metadata?.chunks?.length) continue;

      const hash = order.hash;
      const chainId = order.order?.witness?.chainid;
      const chainName = chainId ? getChainName(chainId) : "—";
      const orderType = order.metadata.orderType ?? "—";
      const link = `${EXPLORER_BASE}/twap/order/${hash}`;

      const partner = chainId
        ? getSpotPartnerConfig(
            spotConfig,
            order.order.witness.exchange.adapter,
            chainId
          )
        : null;
      const partnerName = partner?.partner?.name ?? "—";

      for (const chunk of order.metadata.chunks) {
        const status = (chunk.status ?? "").toLowerCase();
        if (status !== "error") continue;
        if (!chunk.extraTitle) continue;
        if (isFilteredTitle(chunk.extraTitleTranslated)) continue;

        errorChunksTotal++;
        const chunkKey = `${hash}:${chunk.index}`;
        if (seenKeys.has(chunkKey)) continue;

        await markSeen(chunkKey);
        seenKeys.add(chunkKey);

        const extraTitle = truncate(chunk.extraTitle, MAX_EXTRA_TITLE_LENGTH);
        const extraTitleTranslated = truncate(
          chunk.extraTitleTranslated ?? "—",
          MAX_EXTRA_TITLE_LENGTH
        );

        const message = [
          "⚠️ <b>Chunk Error</b>",
          "",
          `<b>Chunk:</b> ${chunk.index} of ${order.metadata.expectedChunks}`,
          `<b>Created at:</b> ${moment(order.timestamp).format("lll")}`,
          `<b>extraTitle:</b> ${escapeHtml(extraTitle)}`,
          `<b>extraTitleTranslated:</b> ${escapeHtml(extraTitleTranslated)}`,
          "",
          `<b>Partner:</b> ${escapeHtml(partnerName)}`,
          `<b>Chain:</b> ${escapeHtml(chainName)} (${chainId ?? "—"})`,
          `<b>Type:</b> ${escapeHtml(orderType)}`,
          `<b>Hash:</b> <code>${hash}</code>`,
          `<b>Link:</b> <a href="${link}">View in Explorer</a>`,
        ].join("\n");

        if (sent > 0) await sleep(TELEGRAM_DELAY_MS);
        await sendTelegram(message);
        sent++;
      }
    }

    return NextResponse.json({
      ok: true,
      checked: sortedOrders.length,
      errorChunks: errorChunksTotal,
      sent,
    });
  } catch (err) {
    console.error("telegram-error-alerts:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
