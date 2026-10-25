// Temporary: restore this flag and the deployment schedule to enable alerts.
export const TELEGRAM_ALERTS_ENABLED = false;

export function telegramAlertsDisabledResponse(): Response {
  return Response.json(
    { error: "Telegram alerts are temporarily disabled" },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
