import { ServiceError, type CommunityRepository } from "@/lib/services/contracts";
import type { ForumPost, ForumThread, Member, MemberPatch } from "@/lib/model/types";
import { BORDERS, EMBLEMS, INKS } from "@/lib/model/vocab";
import { links, members, postSeeds, threadSeeds } from "@/mock/community";

const LIMITS = {
  title: 120,
  body: 8000,
  name: 40,
  role: 40,
  bio: 160,
  about: 20000,
  motto: 48,
  label: 32,
  url: 300,
  links: 8,
};

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

  function clean(value: unknown, max: number, field: string): string {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new ServiceError("invalid", `${field} is required`);
    if (text.length > max) throw new ServiceError("invalid", `${field} is longer than ${max} characters`);
    return text;
  }

  function localized(value: unknown, max: number, field: string) {
    const v = value as { zh?: unknown; en?: unknown } | undefined;
    return { zh: clean(v?.zh, max, `${field} (zh)`), en: clean(v?.en, max, `${field} (en)`) };
  }

  function patchMember(m: Member, patch: MemberPatch): Member {
    const next: Member = structuredClone(m);
    if (patch.name) next.name = localized(patch.name, LIMITS.name, "Name");
    if (patch.role) next.role = localized(patch.role, LIMITS.role, "Role");
    if (patch.bio) next.bio = localized(patch.bio, LIMITS.bio, "Bio");
    if (patch.about !== undefined) {
      if (typeof patch.about !== "string" || patch.about.length > LIMITS.about)
        throw new ServiceError("invalid", "About is too long");
      next.about = patch.about;
    }
    if (patch.links) {
      if (!Array.isArray(patch.links) || patch.links.length > LIMITS.links)
        throw new ServiceError("invalid", `At most ${LIMITS.links} links`);
      next.links = patch.links.map((l) => {
        const url = clean(l?.url, LIMITS.url, "Link address");
        if (!/^(https?:\/\/|mailto:)/i.test(url))
          throw new ServiceError("invalid", "Links must start with http(s):// or mailto:");
        return { label: clean(l?.label, LIMITS.label, "Link label"), url };
      });
    }
    if (patch.github !== undefined) {
      const login = (patch.github ?? "").trim();
      if (login && !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) throw new ServiceError("invalid", "Not a GitHub login");
      next.github = login || undefined;
    }
    if (patch.plate) {
      const p = patch.plate;
      if (p.emblem !== undefined && !EMBLEMS.some((e) => e.id === p.emblem))
        throw new ServiceError("invalid", "Unknown emblem");
      if (p.ink !== undefined && !(p.ink in INKS)) throw new ServiceError("invalid", "Unknown ink");
      if (p.border !== undefined && !(p.border in BORDERS)) throw new ServiceError("invalid", "Unknown border");
      if (p.motto !== undefined && (typeof p.motto !== "string" || p.motto.length > LIMITS.motto))
        throw new ServiceError("invalid", "Motto is too long");
      next.plate = { ...next.plate, ...p, motto: p.motto !== undefined ? p.motto.trim() : next.plate.motto };
    }
    if (patch.coverPrint !== undefined) {
      if (patch.coverPrint !== "original" && patch.coverPrint !== "ink")
        throw new ServiceError("invalid", "Unknown print mode");
      if (next.cover) next.cover = { ...next.cover, print: patch.coverPrint };
    }
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
      const title = clean(input.title, LIMITS.title, "Title");
      const body = clean(input.body, LIMITS.body, "Body");
      const authorName = clean(input.authorName, LIMITS.name, "Name");
      if (!["general", "help", "showcase", "meta"].includes(input.category))
        throw new ServiceError("invalid", "Unknown category");
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
      const body = clean(input.body, LIMITS.body, "Body");
      const authorName = clean(input.authorName, LIMITS.name, "Name");
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
