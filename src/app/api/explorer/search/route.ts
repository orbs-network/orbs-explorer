import { NextResponse } from "next/server";
import { classifySearchInput } from "@/lib/explorer/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const parsed = classifySearchInput(q);

  return NextResponse.json(
    {
      ok: false,
      reason: "not_implemented",
      input: { raw: parsed.raw, trimmed: parsed.trimmed, kind: parsed.kind },
      message:
        "Universal search resolver lands in PR 6. This stub exists so the route is reachable.",
    },
    { status: 501 }
  );
}
