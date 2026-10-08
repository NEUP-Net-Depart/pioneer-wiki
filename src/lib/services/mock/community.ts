import {
  ServiceError,
  type CommunityRepository,
  type LinkPatch,
  type MemberAdminPatch,
} from "@/lib/services/contracts";
import type { ContentVersion, ForumPost, ForumThread, FriendLink, Member } from "@/lib/model/types";
import { links, members, postSeeds, threadSeeds } from "@/mock/community";
import { validateMemberPatch } from "@/lib/members/validation";
import { validatePost, validateThread } from "@/lib/forum/validation";
import { readLocalImage, removeLocalImage, writeLocalImage } from "@/lib/media/store";
import { createMockContext, type MockContext } from "./context";

function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 90 ? `${flat.slice(0, 88)}…` : flat;
}

const HTTP_URL = /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/\S*)?$/i;
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "").toLowerCase() === b.replace(/\/+$/, "").toLowerCase();

/**
 * In-memory community store with the database's rules: links and member pages
 * are versioned and archived rather than deleted, forum threads can be hidden
 * and locked, and every write checks who is asking. Writes live for the
 * process (dev server restarts reset them, like the entry repository).
 */
export function createMockCommunityRepository(
  context: MockContext = createMockContext(() => null),
  people: Member[] = structuredClone(members).map((m) => ({ ...m, version: 1 })),
): CommunityRepository {
  const directory: FriendLink[] = structuredClone(links).map((link, index) => ({
    ...link,
    version: 1,
    sortOrder: index,
  }));
  const posts: ForumPost[] = postSeeds.map((p) => ({ ...p }));
  const threads: ForumThread[] = threadSeeds.map((seed) =>
    summarise({ ...seed, lastActivityAt: seed.createdAt, postCount: 0, excerpt: "" }),
  );
  const versions: ContentVersion[] = [];

  function summarise(thread: ForumThread): ForumThread {
    const own = posts.filter((p) => p.threadId === thread.id && !p.hiddenAt);
    return {
      ...thread,
      postCount: own.length,
      lastActivityAt: own.at(-1)?.createdAt ?? thread.createdAt,
      excerpt: own[0] ? excerptOf(own[0].body) : "",
      hiddenPosts: posts.filter((p) => p.threadId === thread.id && p.hiddenAt).length,
    };
  }
  const record = (kind: ContentVersion["kind"], objectId: string, data: object, note: string) => {
    const number = versions.filter((v) => v.kind === kind && v.objectId === objectId).length + 1;
    versions.unshift({
      kind,
      objectId,
      number,
      note,
      actorId: context.account()?.id,
      createdAt: new Date().toISOString(),
      data: structuredClone(data) as Record<string, unknown>,
    });
  };
  const ownerOrAdmin = (member: Member) => {
    const account = context.requireActive();
    const admin = account.role === "admin";
    if (!admin && account.memberId !== member.id) throw new ServiceError("forbidden", "forbidden");
    if (!admin && member.archivedAt) throw new ServiceError("conflict", "member_archived");
    return admin;
  };
  const findMember = (handle: string, includeArchived = true) =>
    people.find((m) => (m.handle === handle || m.id === handle) && (includeArchived || !m.archivedAt));
  const formerHandles = new Map<string, string>();
  const resolve = (handle: string) => findMember(formerHandles.get(handle) ?? handle);

  function patchMember(m: Member, patch: MemberAdminPatch, admin: boolean): Member {
    const { handle, joined, sample, authorId, ...owner } = patch;
    if (!admin && (handle !== undefined || joined !== undefined || sample !== undefined || authorId !== undefined))
      throw new ServiceError("forbidden", "forbidden_fields");
    const next: Member = structuredClone(m);
    const clean = validateMemberPatch(owner);
    const { plate, github, coverPrint, ...fields } = clean;
    Object.assign(next, fields);
    if (github !== undefined) next.github = github ?? undefined;
    if (plate) next.plate = { ...next.plate, ...plate };
    if (coverPrint && next.cover) next.cover = { ...next.cover, print: coverPrint };
    if (handle !== undefined && handle !== m.handle) {
      const value = handle.trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) || value.length > 32)
        throw new ServiceError("invalid", "invalid_member_handle");
      if (people.some((p) => p.id !== m.id && p.handle === value) || formerHandles.has(value))
        throw new ServiceError("conflict", "member_handle_taken");
      formerHandles.set(m.handle, m.id);
      next.handle = value;
    }
    if (joined !== undefined) next.joined = joined;
    if (sample !== undefined) next.sample = sample;
    if (authorId !== undefined) next.authorId = authorId ?? undefined;
    next.version = (m.version ?? 1) + 1;
    return next;
  }
  const replaceMember = (next: Member, note: string) => {
    const at = people.findIndex((m) => m.id === next.id);
    people[at] = next;
    record("member", next.id, next, note);
    context.audit("update", "member", next.id, null, { version: next.version, note });
    return structuredClone(next);
  };

  return {
    async listLinks(query) {
      const view = query?.view ?? "active";
      if (view !== "active") context.requireActive(true);
      return directory
        .filter((l) => view === "all" || (view === "archived") === Boolean(l.archivedAt))
        .sort((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id))
        .map((l) => structuredClone(l));
    },
    async saveLink(id, patch: LinkPatch, baseVersion) {
      context.requireActive(true);
      if (
        patch.name &&
        (!patch.name.zh.trim() || !patch.name.en.trim() || patch.name.zh.length > 60 || patch.name.en.length > 60)
      )
        throw new ServiceError("invalid", "invalid_link_name");
      if (patch.url !== undefined && (!HTTP_URL.test(patch.url.trim()) || patch.url.length > 300))
        throw new ServiceError("invalid", "invalid_link_url");
      if (patch.description && (patch.description.zh.length > 240 || patch.description.en.length > 240))
        throw new ServiceError("invalid", "invalid_link_description");
      if (patch.emblem !== undefined && !/^geo-[a-z0-9-]+$/.test(patch.emblem))
        throw new ServiceError("invalid", "invalid_link_emblem");
      if (patch.since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.since))
        throw new ServiceError("invalid", "invalid_link_since");
      const url = patch.url?.trim();
      const taken = (except?: string) =>
        url !== undefined && directory.some((l) => l.id !== except && !l.archivedAt && sameUrl(l.url, url));
      let link: FriendLink;
      if (!id) {
        if (!patch.name || !url) throw new ServiceError("invalid", "link_incomplete");
        if (taken()) throw new ServiceError("conflict", "link_url_taken");
        const base =
          patch.name.en
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "friend";
        let linkId = `l-${base}`;
        for (let n = 2; directory.some((l) => l.id === linkId); n++) linkId = `l-${base}-${n}`;
        link = {
          id: linkId,
          name: { zh: patch.name.zh.trim(), en: patch.name.en.trim() },
          url,
          description: patch.description ?? { zh: "", en: "" },
          emblem: patch.emblem ?? "geo-compass",
          since: patch.since ?? new Date().toISOString().slice(0, 10),
          sample: patch.sample ?? false,
          sortOrder: patch.sortOrder ?? 0,
          version: 1,
        };
        directory.push(link);
      } else {
        const at = directory.findIndex((l) => l.id === id);
        if (at < 0) throw new ServiceError("invalid", "link_not_found");
        if (baseVersion !== undefined && baseVersion !== directory[at].version)
          throw new ServiceError("conflict", "version_conflict");
        if (taken(id)) throw new ServiceError("conflict", "link_url_taken");
        link = { ...directory[at], ...patch, url: url ?? directory[at].url, version: (directory[at].version ?? 1) + 1 };
        directory[at] = link;
      }
      record("link", link.id, link, id ? "Saved" : "Created");
      context.audit(id ? "update" : "create", "link", link.id, null, { version: link.version });
      return structuredClone(link);
    },
    async setLinkArchived(id, archived, reason) {
      context.requireActive(true);
      const link = directory.find((l) => l.id === id);
      if (!link) throw new ServiceError("invalid", "link_not_found");
      if (Boolean(link.archivedAt) === archived) throw new ServiceError("conflict", "unchanged_status");
      if (!archived && directory.some((l) => l.id !== id && !l.archivedAt && sameUrl(l.url, link.url)))
        throw new ServiceError("conflict", "link_url_taken");
      link.archivedAt = archived ? new Date().toISOString() : undefined;
      link.version = (link.version ?? 1) + 1;
      record("link", id, link, archived ? "Archived" : "Restored");
      context.audit(archived ? "archive" : "restore", "link", id, null, { reason: reason ?? null });
      return structuredClone(link);
    },
    async listMembers(query) {
      const view = query?.view ?? "active";
      if (view !== "active") context.requireActive(true);
      return people
        .filter((m) => view === "all" || (view === "archived") === Boolean(m.archivedAt))
        .map((m) => structuredClone(m));
    },
    async getMember(handle, query) {
      const member = resolve(handle);
      if (!member) return null;
      if (member.archivedAt) {
        const account = context.account();
        const allowed = query?.includeArchived && (account?.role === "admin" || account?.memberId === member.id);
        if (!allowed) return null;
      }
      return structuredClone(member);
    },
    async updateMember(handle, patch, baseVersion) {
      const member = resolve(handle);
      if (!member) return null;
      const admin = ownerOrAdmin(member);
      if (baseVersion !== undefined && baseVersion !== member.version)
        throw new ServiceError("conflict", "version_conflict");
      return replaceMember(patchMember(member, patch, admin), "Saved");
    },
    async setMemberCover(handle, cover) {
      const member = resolve(handle);
      if (!member) return null;
      ownerOrAdmin(member);
      return replaceMember(
        { ...member, cover: cover ?? undefined, version: (member.version ?? 1) + 1 },
        cover ? "New page image" : "Removed page image",
      );
    },
    async uploadMemberCover(handle, image, print) {
      const member = resolve(handle);
      if (!member) throw new ServiceError("not_found", "member_not_found");
      ownerOrAdmin(member);
      const src = await writeLocalImage(image);
      const previous = member.cover?.src;
      const next = replaceMember(
        {
          ...member,
          cover: { src, width: image.width, height: image.height, print },
          version: (member.version ?? 1) + 1,
        },
        "New page image",
      );
      await removeLocalImage(previous);
      return next;
    },
    async removeMemberCover(handle) {
      const member = resolve(handle);
      if (!member) throw new ServiceError("not_found", "member_not_found");
      ownerOrAdmin(member);
      const previous = member.cover?.src;
      const next = replaceMember(
        { ...member, cover: undefined, version: (member.version ?? 1) + 1 },
        "Removed page image",
      );
      await removeLocalImage(previous);
      return next;
    },
    async readMemberImage(name) {
      return readLocalImage(name);
    },
    async createMember(input) {
      context.requireActive(true);
      const handle = input.handle.trim().toLowerCase();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle) || handle.length > 32)
        throw new ServiceError("invalid", "invalid_member_handle");
      if (people.some((m) => m.handle === handle || m.id === `m-${handle}`) || formerHandles.has(handle))
        throw new ServiceError("conflict", "member_handle_taken");
      if (!input.name.zh.trim() || !input.name.en.trim()) throw new ServiceError("invalid", "invalid_member_name");
      const member: Member = {
        id: `m-${handle}`,
        handle,
        name: input.name,
        role: input.role ?? { zh: "成员", en: "Member" },
        bio: input.bio ?? { zh: "", en: "" },
        about: "",
        plate: {
          number: Math.max(0, ...people.map((m) => m.plate.number)) + 1,
          emblem: input.plate?.emblem ?? "ex-quill",
          ink: (input.plate?.ink as Member["plate"]["ink"]) ?? "prussian",
          border: (input.plate?.border as Member["plate"]["border"]) ?? "vine",
          motto: input.plate?.motto ?? "",
        },
        joined: new Date().toISOString().slice(0, 10),
        authorId: input.authorId,
        links: [],
        projects: [],
        version: 1,
      };
      people.push(member);
      record("member", member.id, member, "Created");
      context.audit("create", "member", member.id, null, { handle });
      return structuredClone(member);
    },
    async setMemberArchived(handle, archived, reason) {
      context.requireActive(true);
      const member = resolve(handle);
      if (!member) throw new ServiceError("not_found", "member_not_found");
      if (Boolean(member.archivedAt) === archived) throw new ServiceError("conflict", "unchanged_status");
      const next = {
        ...member,
        archivedAt: archived ? new Date().toISOString() : undefined,
        version: (member.version ?? 1) + 1,
      };
      context.audit(archived ? "archive" : "restore", "member", member.id, null, { reason: reason ?? null });
      return replaceMember(next, archived ? "Archived" : "Restored");
    },
    async listVersions(kind, objectId) {
      const account = context.account();
      if (account?.role !== "admin" && !(kind === "member" && account?.memberId === objectId))
        throw new ServiceError("forbidden", "forbidden");
      return versions.filter((v) => v.kind === kind && v.objectId === objectId).map((v) => structuredClone(v));
    },
    async restoreVersion(kind, objectId, number) {
      const version = versions.find((v) => v.kind === kind && v.objectId === objectId && v.number === number);
      if (!version) throw new ServiceError("invalid", "version_not_found");
      const data = version.data as Record<string, unknown>;
      if (kind === "member") {
        const member = findMember(objectId);
        if (!member) throw new ServiceError("not_found", "member_not_found");
        const admin = ownerOrAdmin(member);
        const fields = ["name", "role", "bio", "about", "links", "github", "projects"] as const;
        const patch = Object.fromEntries(fields.map((f) => [f, data[f] ?? (f === "github" ? null : undefined)]));
        replaceMember(
          patchMember(member, { ...patch, plate: data.plate as Member["plate"] } as MemberAdminPatch, admin),
          `Restored version ${number}`,
        );
      } else if (kind === "link") {
        const { name, url, description, emblem, since, sortOrder } = data as unknown as FriendLink;
        await this.saveLink(objectId, { name, url, description, emblem, since, sortOrder });
      } else {
        throw new ServiceError("invalid", "invalid_kind");
      }
    },
    async listPostsBy(memberId) {
      return posts
        .filter((p) => p.memberId === memberId && !p.hiddenAt)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .flatMap((post) => {
          const thread = threads.find((th) => th.id === post.threadId && !th.hiddenAt);
          return thread ? [{ post, thread }] : [];
        });
    },
    async listThreads(query) {
      const view = query?.view ?? "public";
      if (view !== "public") context.requireActive(true);
      const offset = query?.offset ?? 0;
      return threads
        .filter((th) => !query?.category || th.category === query.category)
        .filter((th) =>
          view === "public"
            ? !th.hiddenAt
            : view === "hidden"
              ? Boolean(th.hiddenAt)
              : view === "locked"
                ? Boolean(th.lockedAt)
                : true,
        )
        .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))
        .slice(offset, offset + (query?.limit ?? Infinity));
    },
    async getThread(id, query) {
      const thread = threads.find((th) => th.id === id);
      if (!thread || (thread.hiddenAt && !query?.includeHidden)) return null;
      return {
        thread,
        posts: posts
          .filter((p) => p.threadId === id && (query?.includeHidden || !p.hiddenAt))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      };
    },
    async createThread(input) {
      input = validateThread(input);
      const account = context.account();
      if (account) context.requireActive();
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
      const at = threads.findIndex((th) => th.id === input.threadId && !th.hiddenAt);
      if (at < 0) return null;
      input = validatePost(input);
      if (threads[at].lockedAt) throw new ServiceError("conflict", "thread_locked");
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
    async moderateThread(id, action, reason) {
      context.requireActive(true);
      const at = threads.findIndex((th) => th.id === id);
      if (at < 0) throw new ServiceError("invalid", "thread_not_found");
      const thread = threads[at];
      const now = new Date().toISOString();
      if (action === "hide" || action === "restore") {
        if (Boolean(thread.hiddenAt) === (action === "hide")) throw new ServiceError("conflict", "unchanged_status");
        if (action === "hide" && !reason?.trim()) throw new ServiceError("invalid", "reason_required");
        thread.hiddenAt = action === "hide" ? now : undefined;
        thread.moderationNote = action === "hide" ? reason?.trim() : undefined;
      } else {
        if (Boolean(thread.lockedAt) === (action === "lock")) throw new ServiceError("conflict", "unchanged_status");
        thread.lockedAt = action === "lock" ? now : undefined;
        if (action === "lock") thread.moderationNote = reason?.trim() || undefined;
      }
      context.audit(`moderate_${action}`, "thread", id, null, { reason: reason ?? null });
      threads[at] = summarise(thread);
      return structuredClone(threads[at]);
    },
    async moderatePost(id, action, reason) {
      context.requireActive(true);
      const post = posts.find((p) => p.id === id);
      if (!post) throw new ServiceError("invalid", "post_not_found");
      if (Boolean(post.hiddenAt) === (action === "hide")) throw new ServiceError("conflict", "unchanged_status");
      if (action === "hide") {
        if (!reason?.trim()) throw new ServiceError("invalid", "reason_required");
        const first = posts
          .filter((p) => p.threadId === post.threadId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        if (first?.id === post.id) throw new ServiceError("conflict", "hide_thread_instead");
      }
      post.hiddenAt = action === "hide" ? new Date().toISOString() : undefined;
      post.moderationNote = action === "hide" ? reason?.trim() : undefined;
      const at = threads.findIndex((th) => th.id === post.threadId);
      if (at >= 0) threads[at] = summarise(threads[at]);
      context.audit(`moderate_post_${action}`, "post", id, null, { reason: reason ?? null });
      return structuredClone(post);
    },
  };
}
