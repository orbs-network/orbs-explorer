import { POST as resolveTokens } from "@orbs/domain/server/tokens";
import { authorizeApi } from "@/lib/auth";

export async function POST(request: Request) {
  const denied = await authorizeApi();
  if (denied) return denied;
  return resolveTokens(request);
}
