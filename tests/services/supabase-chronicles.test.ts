import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { chronicleTextFilter, createSupabaseServices } from "@/lib/services/supabase";

type Call = [method: string, ...args: unknown[]];
type Response = { data: unknown; error: null; count?: number };

/**
 * A stand-in database: every `from()` starts a request that records each
 * builder call and, when awaited, answers with the next queued response.
 */
function database(responses: Response[]) {
  const requests: Call[][] = [];
  const from = vi.fn((table: string) => {
    const calls: Call[] = [["from", table]];
    requests.push(calls);
    const response = responses.shift() ?? { data: [], error: null };
    const builder: object = new Proxy(
      {},
      {
        get: (_, method) =>
          method === "then"
            ? (resolve: (value: Response) => unknown) => Promise.resolve(response).then(resolve)
            : (...args: unknown[]) => {
                calls.push([String(method), ...args]);
                return builder;
              },
      },
    );
    return builder;
  });
  mocks.client.mockResolvedValue({ from });
  return requests;
}

const row = (id: string, number: number, date: string) => ({
  id,
  number,
  date,
  kind: "meeting",
  title_zh: "例会",
  title_en: "Sitting",
  summary_zh: "摘要",
  summary_en: "Summary",
  host_ids: ["m-qingkong"],
  resources: [],
  gallery: [],
  tags: [],
  sample: true,
});

/** How PostgREST reads a double-quoted value: backslash escapes the next character. */
const unquote = (value: string) => value.slice(1, -1).replace(/\\(.)/g, "$1");

describe("Supabase annals queries (stubbed database)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("matches search words literally in all five text columns", () => {
    for (const words of ["100%", "a_b", "(not *all*), x.y:z", 'say "hi"', "back\\slash", "例会 [S1] $^|?+{}"]) {
      const filter = chronicleTextFilter(words);
      const parts = filter.split(/,(?=(?:title|summary|body)[a-z_]*\.imatch\.)/);
      expect(parts.map((part) => part.split(".imatch.")[0])).toEqual([
        "title_zh",
        "title_en",
        "summary_zh",
        "summary_en",
        "body",
      ]);
      // Once PostgREST unquotes it, the value is a regex that matches exactly the words, case-insensitively.
      const pattern = new RegExp(unquote(parts[0].split(".imatch.")[1]), "i");
      expect(pattern.test(`before ${words.toUpperCase()} after`), words).toBe(true);
      expect(pattern.test(words.replace(/[%_*]/g, "Q")), words).toBe(/[%_*]/.test(words) ? false : true);
    }
  });

  it("filters before it orders and cuts a page, and counts with the same filters", async () => {
    const requests = database([
      { data: [row("ch-0002", 2, "2026-06-08")], error: null },
      { data: null, error: null, count: 41 },
    ]);
    const { chronicles } = createSupabaseServices();
    const query = { q: " 例会, (1) ", year: 2026, kind: ["meeting" as const], member: "m-qingkong" };
    const list = await chronicles.listChronicles({ ...query, limit: 40, offset: 40 });
    expect(list.map((record) => record.id)).toEqual(["ch-0002"]);
    expect(await chronicles.countChronicles(query)).toBe(41);

    const [listing, counting] = requests;
    const methods = listing.map(([method]) => method);
    // Archived records are left out of every public read, before any other filter.
    expect(methods).toEqual(["from", "select", "is", "in", "gte", "lte", "contains", "or", "order", "order", "range"]);
    expect(listing).toContainEqual(["is", "archived_at", null]);
    expect(listing[1][1]).not.toContain("body");
    expect(listing).toContainEqual(["contains", "host_ids", ["m-qingkong"]]);
    expect(listing).toContainEqual(["or", chronicleTextFilter("例会, (1)")]);
    expect(listing.at(-1)).toEqual(["range", 40, 79]);
    expect(counting[1]).toEqual(["select", "id", { count: "exact", head: true }]);
    expect(counting.map(([method]) => method)).toEqual(["from", "select", "is", "in", "gte", "lte", "contains", "or"]);
  });

  it("leaves blank words out of the request", async () => {
    const requests = database([{ data: [], error: null }]);
    await createSupabaseServices().chronicles.listChronicles({ q: "   " });
    expect(requests[0].map(([method]) => method)).not.toContain("or");
  });

  it("reads the facets from the whole table, a thousand rows at a time", async () => {
    const page = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        date: `${2020 + ((from + i) % 3)}-03-01`,
        kind: "meeting",
        host_ids: [`m-${(from + i) % 2}`],
        sample: i === 0,
      }));
    const requests = database([
      { data: page(0, 1000), error: null },
      { data: page(1000, 5), error: null },
    ]);
    const facets = await createSupabaseServices().chronicles.chronicleFacets();
    expect(facets).toEqual({
      total: 1005,
      samples: 2,
      years: [2022, 2021, 2020],
      kinds: ["meeting"],
      memberIds: ["m-0", "m-1"],
    });
    expect(requests.map((calls) => calls.at(-1))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
    ]);
  });

  it("finds the neighbours by date, then number, across the full register", async () => {
    const requests = database([
      { data: { date: "2026-09-07", number: 6 }, error: null },
      { data: row("ch-0005", 5, "2026-08-03"), error: null },
      { data: row("ch-0007", 7, "2026-09-21"), error: null },
    ]);
    const { older, newer } = await createSupabaseServices().chronicles.adjacentChronicles("ch-0006");
    expect([older?.id, newer?.id]).toEqual(["ch-0005", "ch-0007"]);
    expect(requests[1]).toContainEqual(["or", "date.lt.2026-09-07,and(date.eq.2026-09-07,number.lt.6)"]);
    expect(requests[2]).toContainEqual(["or", "date.gt.2026-09-07,and(date.eq.2026-09-07,number.gt.6)"]);

    database([{ data: null, error: null }]);
    expect(await createSupabaseServices().chronicles.adjacentChronicles("ch-9999")).toEqual({
      older: null,
      newer: null,
    });
  });
});
