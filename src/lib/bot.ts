import { Telegraf } from "telegraf";

let bot: Telegraf | null = null;

export function getBot() {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");
    bot = new Telegraf(token);
    // IMPORTANT: do NOT call bot.launch() in serverless
  }
  return bot;
}
