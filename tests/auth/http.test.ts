import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
import { clientAddress, safeNext, siteUrl, validEmail } from "@/lib/http/site";
import { fromDatabaseError, reasonText } from "@/lib/services/errors";
import { dataSource } from "@/lib/services";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("request plumbing", () => {
  it("continues only to same-site paths", () => {
    expect(safeNext("/account/entries?x=1")).toBe("/account/entries?x=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null])
      expect(safeNext(bad as string)).toBe("/account");
  });

  it("builds email links from the configured site, never the Host header", () => {
    vi.stubEnv("PIONEER_SITE_URL", "https://wiki.example.org/");
    expect(siteUrl(new Request("http://attacker.example/x"))).toBe("https://wiki.example.org");
    vi.stubEnv("PIONEER_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => siteUrl(new Request("http://attacker.example/x"))).toThrowError(expect.objectContaining({ reason: "site_url_missing" }));
  });

  it("trusts a proxy-set client address only when told a proxy is in front", () => {
    const request = new Request("http://x/", { headers: { "x-real-ip": "203.0.113.9" } });
    expect(clientAddress(request)).toBe("unknown");
    vi.stubEnv("PIONEER_TRUST_PROXY", "1");
    expect(clientAddress(request)).toBe("203.0.113.9");
    expect(clientAddress(new Request("http://x/", { headers: { "x-real-ip": "not an ip; drop" } }))).toBe("unknown");
  });

  it("normalises email addresses and rejects malformed ones", () => {
    expect(validEmail("  Reader@Example.COM ")).toBe("reader@example.com");
    expect(() => validEmail("not-an-email")).toThrowError(expect.objectContaining({ reason: "invalid_email" }));
  });

  it("maps database refusals to codes and reasons, keeping only safe detail", () => {
    expect(fromDatabaseError({ code: "40001", message: "revision_conflict" })).toMatchObject({ code: "conflict", reason: "revision_conflict" });
    expect(fromDatabaseError({ code: "42501", message: "permission denied for table entries" })).toMatchObject({ code: "forbidden", reason: "forbidden" });
    expect(fromDatabaseError({ code: "PW429", message: "rate_limited" })).toMatchObject({ code: "rate_limited" });
    expect(fromDatabaseError({ code: "40001", message: "assets_not_approved", details: "asset-1" })).toMatchObject({ detail: "asset-1" });
    expect(fromDatabaseError({ code: "XX000", message: "internal: relation \"secret\" at 10.0.0.1" })).toMatchObject({
      code: "unavailable",
      reason: "unavailable",
    });
    expect(reasonText("no_such_reason", "en", "conflict")).toBe(reasonText("conflict", "en"));
  });

  it("reads Supabase settings at run time, preferring the server-side names", () => {
    vi.stubEnv("SUPABASE_URL", "https://runtime.example");
    vi.stubEnv("SUPABASE_ANON_KEY", "runtime-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://public.example");
    expect(getSupabaseConfig()).toEqual({ url: "https://runtime.example", anonKey: "runtime-key" });
  });

  it("refuses to serve production from the fixtures unless told to", () => {
    vi.stubEnv("PIONEER_DATA_SOURCE", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => dataSource()).toThrowError(/Supabase is not configured/);
    vi.stubEnv("PIONEER_DATA_SOURCE", "mock");
    expect(dataSource()).toBe("mock");
  });

  it("refuses cross-site API writes before any cookie is used", async () => {
    vi.stubEnv("PIONEER_DATA_SOURCE", "mock");
    const cross = await proxy(
      new NextRequest("https://wiki.example.org/api/drafts", { method: "POST", headers: { origin: "https://evil.example", host: "wiki.example.org" } }),
    );
    expect(cross.status).toBe(403);
    const fetchSite = await proxy(
      new NextRequest("https://wiki.example.org/api/drafts", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(fetchSite.status).toBe(403);
    const same = await proxy(
      new NextRequest("https://wiki.example.org/api/drafts", { method: "POST", headers: { origin: "https://wiki.example.org", host: "wiki.example.org" } }),
    );
    expect(same.status).toBe(200);
  });
});
