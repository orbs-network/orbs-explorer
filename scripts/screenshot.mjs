#!/usr/bin/env node
/**
 * Capture screenshots of the running dev server at desktop + mobile viewports.
 *
 * Usage:
 *   node scripts/screenshot.mjs <label> <paths-comma-separated> [--base-url=<url>]
 *
 * Examples:
 *   node scripts/screenshot.mjs before /,/explorer,/explorer/blocks
 *   node scripts/screenshot.mjs after /explorer --base-url=http://localhost:3003
 *
 * Output:
 *   .screenshots/<label>/<desktop|mobile>/<safe-path>.png
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2 },
];

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [key, value = "true"] = arg.slice(2).split("=");
      flags[key] = value;
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function safeName(path) {
  if (path === "/" || path === "") return "root";
  return path
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [label, pathsArg] = positional;
  if (!label || !pathsArg) {
    console.error(
      "Usage: node scripts/screenshot.mjs <label> <paths-comma-separated> [--base-url=http://localhost:3003]"
    );
    process.exit(2);
  }

  const baseUrl = flags["base-url"] ?? "http://localhost:3003";
  const paths = pathsArg
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const outDir = resolve(process.cwd(), ".screenshots", label);

  console.log(`label=${label} baseUrl=${baseUrl} paths=${paths.length}`);

  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor ?? 1,
        colorScheme: "dark",
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      const dir = resolve(outDir, vp.name);
      await mkdir(dir, { recursive: true });

      for (const path of paths) {
        const url = baseUrl + path;
        const file = resolve(dir, `${safeName(path)}.png`);
        try {
          const response = await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });
          // Hydration + React Query fetches fire AFTER initial networkidle.
          // Wait for skeletons to disappear, then settle the network again.
          // Bounded so a legitimately-loading page doesn't hang the run.
          try {
            await page.waitForFunction(
              () => !document.querySelector(".animate-pulse"),
              { timeout: 5_000 }
            );
            await page.waitForLoadState("networkidle", { timeout: 5_000 });
          } catch {
            /* selector may not exist; fall through */
          }
          await page.waitForTimeout(400);
          await page.screenshot({ path: file, fullPage: true });
          console.log(
            `  ${vp.name.padEnd(7)} ${String(response?.status() ?? "?").padStart(3)}  ${path}  ->  ${file}`
          );
        } catch (err) {
          console.error(`  ${vp.name.padEnd(7)} FAIL ${path}: ${err.message}`);
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
