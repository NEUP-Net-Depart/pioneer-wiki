import { describe, expect, it } from "vitest";
import { createMockServices } from "@/lib/services/mock";
import { createMockCommunityRepository } from "@/lib/services/mock/community";
import { createMockContext } from "@/lib/services/mock/context";
import type { Account } from "@/lib/model/types";

const reader: Account = {
  id: "u-reader",
  email: "reader@example.test",
  handle: "reader",
  name: { zh: "读者", en: "Reader" },
  sigil: "r",
  role: "reader",
  emailVerified: true,
  status: "active",
  memberId: "m-sample-a",
};

describe("community administration (fixtures backend)", () => {
  it("lists a link address once, and takes archived links out of the directory", async () => {
    const { community } = createMockServices();
    const link = await community.saveLink(null, {
      name: { zh: "友站", en: "Friend Site" },
      url: "https://friend.example.org/",
      description: { zh: "简介", en: "About" },
      emblem: "geo-ship",
      since: "2026-10-01",
    });
    await expect(
      community.saveLink(null, { name: { zh: "重", en: "Dup" }, url: "https://FRIEND.example.org" }),
    ).rejects.toMatchObject({
      reason: "link_url_taken",
    });
    await expect(
      community.saveLink(null, { name: { zh: "坏", en: "Bad" }, url: "javascript:alert(1)" }),
    ).rejects.toMatchObject({
      reason: "invalid_link_url",
    });
    await expect(community.saveLink(link.id, { description: { zh: "新", en: "New" } }, 99)).rejects.toMatchObject({
      reason: "version_conflict",
    });
    await community.setLinkArchived(link.id, true);
    expect((await community.listLinks()).some((l) => l.id === link.id)).toBe(false);
    expect((await community.listLinks({ view: "archived" })).map((l) => l.id)).toEqual([link.id]);
    const versions = await community.listVersions("link", link.id);
    expect(versions.map((v) => v.note)).toEqual(["Archived", "Created"]);
  });

  it("keeps the chart order by joining date whatever is added or archived", async () => {
    const { community } = createMockServices();
    await community.saveLink(null, {
      name: { zh: "早", en: "Early" },
      url: "https://early.example.org",
      since: "2020-01-01",
    });
    const order = (await community.listLinks()).map((l) => l.since);
    expect(order).toEqual([...order].sort());
  });

  it("lets a member edit only their own page and only the fields that are theirs", async () => {
    const community = createMockCommunityRepository(createMockContext(() => reader));
    await expect(community.updateMember("qingkong", { bio: { zh: "x", en: "x" } })).rejects.toMatchObject({
      reason: "forbidden",
    });
    await expect(community.updateMember("sample-a", { handle: "taken" })).rejects.toMatchObject({
      reason: "forbidden_fields",
    });
    const saved = await community.updateMember("sample-a", { bio: { zh: "新简介", en: "New bio" } });
    expect(saved?.bio.en).toBe("New bio");
    expect((await community.listVersions("member", "m-sample-a")).length).toBe(1);
  });

  it("archives a page without touching its account, hides it from readers, and restores a version", async () => {
    const { community } = createMockServices();
    await community.updateMember("qingkong", { bio: { zh: "一", en: "one" } });
    await community.updateMember("qingkong", { bio: { zh: "二", en: "two" } });
    const [latest, previous] = await community.listVersions("member", "m-qingkong");
    expect(latest.number).toBe(2);
    await community.restoreVersion("member", "m-qingkong", previous.number);
    expect((await community.getMember("qingkong"))?.bio.en).toBe("one");
    await community.setMemberArchived("qingkong", true, "test");
    expect((await community.listMembers()).some((m) => m.id === "m-qingkong")).toBe(false);
    expect(await community.getMember("qingkong")).toBeNull();
    // Its owner and administrators still open it, with the archive notice.
    expect((await community.getMember("qingkong", { includeArchived: true }))?.archivedAt).toBeTruthy();
  });

  it("moderates the forum: locked threads take no replies, hidden ones leave public reads", async () => {
    const { community } = createMockServices();
    const [thread] = await community.listThreads();
    await community.moderateThread(thread.id, "lock", "Resolved");
    await expect(community.reply({ threadId: thread.id, body: "late", authorName: "x" })).rejects.toMatchObject({
      reason: "thread_locked",
    });
    await expect(community.moderateThread(thread.id, "hide")).rejects.toMatchObject({ reason: "reason_required" });
    await community.moderateThread(thread.id, "hide", "Off topic");
    expect((await community.listThreads()).some((t) => t.id === thread.id)).toBe(false);
    expect(await community.getThread(thread.id)).toBeNull();
    expect((await community.getThread(thread.id, { includeHidden: true }))?.thread.hiddenAt).toBeTruthy();
    const opening = (await community.getThread(thread.id, { includeHidden: true }))!.posts[0];
    await expect(community.moderatePost(opening.id, "hide", "x")).rejects.toMatchObject({
      reason: "hide_thread_instead",
    });
  });

  it("adds, edits and archives chronicles, keeping them out of the public register when archived", async () => {
    const { chronicles } = createMockServices();
    const record = await chronicles.saveChronicle(null, {
      date: "2026-10-08",
      kind: "meeting",
      title: { zh: "例会", en: "Meeting" },
      summary: { zh: "摘要", en: "Summary" },
      resources: [{ kind: "video", label: { zh: "录像", en: "Recording" }, url: "https://video.example.org/1" }],
    });
    expect(record.id).toMatch(/^ch-\d{4}$/);
    await expect(
      chronicles.saveChronicle(record.id, {
        resources: [{ kind: "link", label: { zh: "x", en: "x" }, url: "ftp://x" }],
      }),
    ).rejects.toMatchObject({
      reason: "invalid_chronicle_resources",
    });
    await chronicles.setChronicleArchived(record.id, true);
    expect(await chronicles.getChronicle(record.id)).toBeNull();
    expect((await chronicles.listChronicles()).some((c) => c.id === record.id)).toBe(false);
    expect((await chronicles.getChronicle(record.id, { includeArchived: true }))?.archivedAt).toBeTruthy();
  });
});
