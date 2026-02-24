import { GET as runTelegramAlerts } from "../cron/telegram-error-alerts/route";

export async function GET(request: Request) {
  const req = new Request(request.url, {
    headers: process.env.CRON_SECRET
      ? new Headers({
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        })
      : undefined,
  });
  return runTelegramAlerts(req);
}
