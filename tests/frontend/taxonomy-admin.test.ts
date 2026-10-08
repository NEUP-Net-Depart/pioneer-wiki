import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Account } from "@/lib/model/types";
import { createMockServices } from "@/lib/services/mock";

vi.mock("server-only", () => ({}));

let services = createMockServices();
let account: Account | null = null;
vi.mock("@/lib/services", () => ({
  getServices: () => ({ ...services, auth: { ...services.auth, getCurrentAccount: async () => account } }),
}));

const admin: Account = {
  id: "a-qingkong",
  email: "qingkong@example.test",
  handle: "qingkong",
  name: { zh: "青空", en: "Qingkong" },
  sigil: "q",
  role: "admin",
  emailVerified: true,
  authorId: "a-qingkong",
};
const reader: Account = { ...admin, id: "u-reader", role: "reader", authorId: undefined };

const json = (body: unknown) =>
  new NextRequest("http://wiki.test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) }) as never;

beforeEach(() => {
  services = createMockServices();
  account = admin;
});

describe("taxonomy admin API", () => {
  it("lets only a verified administrator write", async () => {
    const { PATCH } = await import("@/app/api/admin/taxonomy/[kind]/[id]/route");
    account = null;
    expect((await PATCH(json({ patch: { sortOrder: 2 } }), ctx({ kind: "category", id: "databases" }))).status).toBe(
      401,
    );
    account = reader;
    expect((await PATCH(json({ patch: { sortOrder: 2 } }), ctx({ kind: "category", id: "databases" }))).status).toBe(
      403,
    );
    account = { ...admin, emailVerified: false };
    expect((await PATCH(json({ patch: { sortOrder: 2 } }), ctx({ kind: "category", id: "databases" }))).status).toBe(
      403,
    );
  });

  it("saves at once and records who changed it", async () => {
    const { PATCH } = await import("@/app/api/admin/taxonomy/[kind]/[id]/route");
    const res = await PATCH(
      json({ patch: { intro: { zh: "数据的长期保存。", en: "Keeping data." } }, note: "intro", baseVersion: 1 }),
      ctx({ kind: "category", id: "databases" }),
    );
    expect(res.status).toBe(200);
    const version = await res.json();
    expect(version).toMatchObject({ number: 2, note: "intro", authorId: "a-qingkong" });
    expect((await services.taxonomy.getCategory("databases"))?.intro.zh).toBe("数据的长期保存。");
  });

  it("answers validation, conflicts and unknown kinds with the right status", async () => {
    const { PATCH } = await import("@/app/api/admin/taxonomy/[kind]/[id]/route");
    const { POST: status } = await import("@/app/api/admin/taxonomy/[kind]/[id]/status/route");
    const badLink = { patch: { links: [{ label: { zh: "x", en: "x" }, url: "javascript:alert(1)" }] } };
    expect((await PATCH(json(badLink), ctx({ kind: "category", id: "databases" }))).status).toBe(422);
    expect(
      (await PATCH(json({ patch: { sortOrder: 2 }, baseVersion: 9 }), ctx({ kind: "category", id: "databases" })))
        .status,
    ).toBe(409);
    expect((await PATCH(json({ patch: {} }), ctx({ kind: "order", id: "databases" }))).status).toBe(422);
    const refused = await status(json({ status: "archived" }), ctx({ kind: "family", id: "ai" }));
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toMatchObject({ code: "conflict", reason: "family_has_active_genera" });
  });

  it("archives and restores but never deletes", async () => {
    const { DELETE } = await import("@/app/api/admin/taxonomy/[kind]/[id]/route");
    const { POST: status } = await import("@/app/api/admin/taxonomy/[kind]/[id]/status/route");
    expect((await DELETE()).status).toBe(405);
    expect((await status(json({ status: "archived" }), ctx({ kind: "category", id: "cloud-devops" }))).status).toBe(
      200,
    );
    expect(await services.taxonomy.getCategory("cloud-devops")).toBeNull();
    expect((await status(json({ status: "active" }), ctx({ kind: "category", id: "cloud-devops" }))).status).toBe(200);
    expect((await services.taxonomy.getCategory("cloud-devops"))?.status).toBe("active");
  });

  it("lists versions and reverts as a new version", async () => {
    const { PATCH } = await import("@/app/api/admin/taxonomy/[kind]/[id]/route");
    const { GET } = await import("@/app/api/admin/taxonomy/[kind]/[id]/versions/route");
    const { POST: revert } = await import("@/app/api/admin/taxonomy/[kind]/[id]/revert/route");
    await PATCH(json({ patch: { slug: "data-stores" }, note: "rename" }), ctx({ kind: "category", id: "databases" }));
    const back = await revert(json({ version: 1 }), ctx({ kind: "category", id: "databases" }));
    expect((await back.json()).data.slug).toBe("databases");
    const list = await (await GET(new Request("http://wiki.test"), ctx({ kind: "category", id: "databases" }))).json();
    expect(list.map((v: { number: number }) => v.number)).toEqual([3, 2, 1]);
  });

  it("creates a genus in a family", async () => {
    const { POST } = await import("@/app/api/admin/taxonomy/[kind]/route");
    const res = await POST(
      json({
        patch: {
          slug: "quantum-computing",
          name: { zh: "量子计算", en: "Quantum Computing" },
          scientificName: "Aglais",
          familyId: "computing-foundations",
        },
        note: "new genus",
      }),
      ctx({ kind: "category" }),
    );
    expect(res.status).toBe(201);
    expect((await services.taxonomy.listCategories({ familyId: "computing-foundations" })).map((c) => c.id)).toContain(
      "quantum-computing",
    );
  });
});

describe("catalogue addresses settled before streaming", () => {
  const resolve = async (path: string) => {
    const { resolveCatalogueAddress } = await import("@/lib/taxonomy/address");
    return resolveCatalogueAddress(new NextRequest(`http://wiki.test${path}`));
  };

  it("lets a current slug render and leaves other paths alone", async () => {
    expect(await resolve("/categories/databases")).toBeNull();
    expect(await resolve("/families/ai")).toBeNull();
    expect(await resolve("/entries/raft-consensus")).toBeNull();
  });

  it("answers a former slug with a real 308 and an unknown or archived taxon with a real 404", async () => {
    await services.taxonomy.saveTaxon({
      kind: "category",
      id: "databases",
      patch: { slug: "data-stores" },
      note: "rename",
    });
    const moved = await resolve("/categories/databases");
    expect(moved?.status).toBe(308);
    expect(new URL(moved?.headers.get("location") ?? "").pathname).toBe("/categories/data-stores");
    expect((await resolve("/families/no-such"))?.status).toBe(404);
    await services.taxonomy.archiveTaxon("category", "observability");
    expect((await resolve("/categories/observability"))?.status).toBe(404);
  });
});
