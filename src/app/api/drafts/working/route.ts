import { NextRequest, NextResponse } from "next/server";
import { verifiedAccountOrResponse } from "@/lib/auth/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const gate = await verifiedAccountOrResponse();
  if ("response" in gate) return gate.response;
  if (!gate.account.authorId)
    return NextResponse.json(
      { error: { code: "forbidden", message: "Bind a Wiki author before editing." } },
      { status: 403 },
    );
  if (!getSupabaseConfig()) return NextResponse.json({ ok: true, localOnly: true });
  const input = (await request.json()) as { id?: string; entryId?: string; baseRevision?: number; payload?: unknown };
  const id = input.id && UUID.test(input.id) ? input.id : crypto.randomUUID();
  if (!input.payload || JSON.stringify(input.payload).length > 2_000_000)
    return NextResponse.json(
      { error: { code: "invalid", message: "Draft payload is empty or too large." } },
      { status: 422 },
    );
  const client = await createSupabaseServerClient();
  const { error } = await client.from("entry_working_drafts").upsert(
    {
      id,
      entry_id: input.entryId ?? null,
      owner_id: gate.account.id,
      author_id: gate.account.authorId,
      base_revision: input.baseRevision ?? null,
      payload: input.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) return NextResponse.json({ error: { code: "unavailable", message: error.message } }, { status: 503 });
  return NextResponse.json({ ok: true, draftId: id, savedAt: new Date().toISOString() });
}
