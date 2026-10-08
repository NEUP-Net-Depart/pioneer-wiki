import "server-only";
import { NextResponse } from "next/server";
import type { TaxonKind } from "@/lib/model/types";
import { failure } from "@/lib/http/route";

export const isTaxonKind = (value: string): value is TaxonKind => value === "family" || value === "category";

/** The HTTP answer for a failed taxonomy write, in the shared error shape. */
export function taxonomyError(error: unknown) {
  return failure(error);
}

export const unknownKind = () =>
  NextResponse.json({ error: { code: "invalid", reason: "invalid_kind", message: "Unknown taxon kind." } }, { status: 422 });
