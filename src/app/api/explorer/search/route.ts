import { NextResponse } from "next/server";
import { resolveSearch } from "@/lib/explorer/resolver";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const result = await resolveSearch(q, url.origin);

  if (result.kind === "redirect") {
    return NextResponse.json(result, { status: 200 });
  }
  if (result.kind === "empty") {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 404 });
}
