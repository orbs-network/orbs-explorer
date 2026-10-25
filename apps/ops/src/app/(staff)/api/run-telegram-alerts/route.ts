import { GET as runTelegramAlerts } from "../cron/telegram-error-alerts/route";

import { authorizeApi, isSameOrigin } from "../../../../lib/auth";
import { NextResponse } from "next/server";
import {
  TELEGRAM_ALERTS_ENABLED,
  telegramAlertsDisabledResponse,
} from "../../../../lib/telegram-alerts";

export async function POST(request: Request) {
  if (!TELEGRAM_ALERTS_ENABLED) return telegramAlertsDisabledResponse();
  const denied = await authorizeApi();
  if (denied) return denied;
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  const req = new Request(request.url, {
    headers: process.env.CRON_SECRET
      ? new Headers({
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        })
      : undefined,
  });
  return runTelegramAlerts(req);
}
