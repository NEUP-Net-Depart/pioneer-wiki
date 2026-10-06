import { NextRequest, NextResponse } from "next/server";
import { getServices } from "@/lib/services";
import type { DomainId, Lang, ReviewState, Scale } from "@/lib/model/types";

function values(request: NextRequest, key: string): string[] | undefined {
  const all = request.nextUrl.searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .filter(Boolean);
  return all.length ? all : undefined;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const result = await getServices().search.search({
    text: p.get("q") ?? "",
    limit: Number(p.get("limit") ?? 50),
    offset: Number(p.get("offset") ?? 0),
    filters: {
      domain: values(request, "domain") as DomainId[] | undefined,
      scale: values(request, "scale") as Scale[] | undefined,
      status: values(request, "status") as ReviewState[] | undefined,
      lang: values(request, "lang") as Lang[] | undefined,
      author: values(request, "author"),
    },
  });
  return NextResponse.json(result);
}
