import type { CommunityRepository } from "@/lib/services/contracts";
import type { ForumPost, ForumThread, Member, MemberPatch } from "@/lib/model/types";
import { links, members, postSeeds, threadSeeds } from "@/mock/community";
import { validateMemberPatch } from "@/lib/members/validation";
import { validatePost, validateThread } from "@/lib/forum/validation";

function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 88)}…` : flat;
}

/**
 * In-memory community store: friend links and members are read-only fixtures;
 * forum threads and posts accept writes for the life of the process (dev
 * server restarts reset them, like the entry repository).
 */
export function createMockCommunityRepository(): CommunityRepository {
  const people: Member[] = structuredClone(members);
  const posts: ForumPost[] = postSeeds.map((p) => ({ ...p }));
  const threads: ForumThread[] = threadSeeds.map((seed) =>
    summarise({ ...seed, lastActivityAt: seed.createdAt, postCount: 0, excerpt: "" }),
  );

  function summarise(thread: ForumThread): ForumThread {
    const own = posts.filter((p) => p.threadId === thread.id);
    return {
      ...thread,
      postCount: own.length,
      lastActivityAt: own.at(-1)?.createdAt ?? thread.createdAt,
      excerpt: own[0] ? excerptOf(own[0].body) : "",
    };
  }

  function patchMember(m: Member, patch: MemberPatch): Member {
    const next: Member = structuredClone(m);
    const clean = validateMemberPatch(patch);
    const { plate, github, coverPrint, ...fields } = clean;
    Object.assign(next, fields);
    if (github !== undefined) next.github = github ?? undefined;
    if (plate) next.plate = { ...next.plate, ...plate };
    if (coverPrint && next.cover) next.cover = { ...next.cover, print: coverPrint };
    return next;
  }

  return {
    listLinks: async () => links,
    listMembers: async () => people,
    getMember: async (handle) => people.find((m) => m.handle === handle) ?? null,

    async updateMember(handle, patch) {
      const at = people.findIndex((m) => m.handle === handle);
      if (at < 0) return null;
      people[at] = patchMember(people[at], patch);
      return people[at];
    },

    async setMemberCover(handle, cover) {
      const at = people.findIndex((m) => m.handle === handle);
      if (at < 0) return null;
      people[at] = { ...people[at], cover: cover ?? undefined };
      return people[at];
    },

    async listPostsBy(memberId) {
      return posts
        .filter((p) => p.memberId === memberId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .flatMap((post) => {
          const thread = threads.find((th) => th.id === post.threadId);
          return thread ? [{ post, thread }] : [];
        });
    },

    async listThreads(query) {
      return threads
        .filter((th) => !query?.category || th.category === query.category)
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(0, query?.limit ?? Infinity);
    },

    async getThread(id) {
      const thread = threads.find((th) => th.id === id);
      if (!thread) return null;
      return {
        thread,
        posts: posts.filter((p) => p.threadId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    },

    async createThread(input) {
      input = validateThread(input);
      const { title, body, authorName } = input;
      const number = Math.max(0, ...threads.map((th) => th.number)) + 1;
      const now = new Date().toISOString();
      const id = `t-${number}`;
      posts.push({ id: `p-${number}-1`, threadId: id, authorName, memberId: input.memberId, body, createdAt: now });
      const thread = summarise({
        id,
        number,
        title,
        category: input.category,
        authorName,
        memberId: input.memberId,
        createdAt: now,
        lastActivityAt: now,
        postCount: 0,
        excerpt: "",
      });
      threads.push(thread);
      return thread;
    },

    async reply(input) {
      const at = threads.findIndex((th) => th.id === input.threadId);
      if (at < 0) return null;
      input = validatePost(input);
      const { body, authorName } = input;
      const n = posts.filter((p) => p.threadId === input.threadId).length + 1;
      const post: ForumPost = {
        id: `p-${threads[at].number}-${n}`,
        threadId: input.threadId,
        authorName,
        memberId: input.memberId,
        body,
        createdAt: new Date().toISOString(),
      };
      posts.push(post);
      threads[at] = summarise(threads[at]);
      return post;
    },
  };
}
