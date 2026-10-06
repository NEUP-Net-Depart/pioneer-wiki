import "server-only";
import { NextResponse } from "next/server";
import { getServices } from "@/lib/services";

/**
 * A member's page may be edited only by that member: the signed-in author must
 * be the one linked to the member record. Returns an error response, or null
 * when the request may proceed.
 */
export async function ownerOf(handle: string): Promise<NextResponse | null> {
  const { auth, community } = getServices();
  const [user, member] = await Promise.all([auth.getCurrentUser(), community.getMember(handle)]);
  if (!member) return NextResponse.json({ error: { code: "not_found", message: "No such member" } }, { status: 404 });
  if (!user)
    return NextResponse.json({ error: { code: "forbidden", message: "Sign in to edit your page" } }, { status: 401 });
  if (member.authorId !== user.id)
    return NextResponse.json(
      { error: { code: "forbidden", message: "You can only edit your own page" } },
      { status: 403 },
    );
  return null;
}
