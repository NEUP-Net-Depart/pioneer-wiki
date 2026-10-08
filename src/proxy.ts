import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { resolveCatalogueAddress } from "@/lib/taxonomy/address";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * A write to the API must come from this site. Browsers send Origin on every
 * cross-origin request and on same-origin fetches; a mismatch, or a fetch the
 * browser marks cross-site, is refused before any cookie is used. Requests
 * without either header are not from a browser and carry no session cookie.
 */
function crossSiteWrite(request: NextRequest): boolean {
  if (!WRITES.has(request.method) || !request.nextUrl.pathname.startsWith("/api/")) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  const allowed = new Set([request.headers.get("x-forwarded-host"), request.headers.get("host"), request.nextUrl.host]);
  const site = process.env.PIONEER_SITE_URL;
  if (site) {
    try {
      allowed.add(new URL(site).host);
    } catch {
      // A malformed site address is reported by the readiness probe, not here.
    }
  }
  return !allowed.has(host);
}

/**
 * Refuses cross-site API writes, refreshes Supabase's auth cookies before
 * Server Components read the session, and settles catalogue addresses (308 for
 * a former slug, 404 for an unknown taxon) before a streamed page fixes the
 * status at 200.
 */
export async function proxy(request: NextRequest) {
  if (crossSiteWrite(request))
    return NextResponse.json(
      { error: { code: "forbidden", reason: "cross_site_request", message: "Cross-site request refused." } },
      { status: 403 },
    );
  const settled = await resolveCatalogueAddress(request);
  if (settled) return settled;
  const config = getSupabaseConfig();
  if (!config || process.env.PIONEER_DATA_SOURCE === "mock") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes an expiring session; a failure (Auth briefly unreachable) leaves the request as it was.
  await supabase.auth.getUser().catch(() => undefined);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
