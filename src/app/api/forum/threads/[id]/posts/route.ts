import { handle, notFound, ok, readJson, requireAccount } from "@/lib/http/route";
import { getServices } from "@/lib/services";

/** POST { body } → ForumPost (201); 404 when the thread does not exist; 409 when it is locked. */
export async function POST(request: Request, { params }: RouteContext<"/api/forum/threads/[id]/posts">) {
  return handle(async () => {
    const account = await requireAccount();
    const { id } = await params;
    const input = await readJson<{ body?: string }>(request);
    const { community } = getServices();
    const member = account.memberId ? await community.getMember(account.memberId) : null;
    const post = await community.reply({
      threadId: id,
      body: input.body ?? "",
      authorName: member?.name.zh || account.name.zh,
      memberId: member?.id,
    });
    if (!post) notFound("thread_not_found");
    return ok(post, 201);
  });
}
