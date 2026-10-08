import "server-only";
import type { WikiServices } from "./contracts";
import { createMockServices } from "./mock";
import { createSupabaseServices } from "./supabase";
import { hasSupabaseEnv } from "@/lib/supabase/config";

const globalForServices = globalThis as typeof globalThis & { __pioneerServices?: WikiServices };

export type DataSource = "mock" | "supabase";

/**
 * Which backend serves this process. An explicit PIONEER_DATA_SOURCE wins; a
 * production server without one must have Supabase configured, because the
 * fixtures keep writes in memory and lose them on restart.
 */
export function dataSource(): DataSource {
  const explicit = process.env.PIONEER_DATA_SOURCE?.trim();
  if (explicit) {
    if (explicit !== "mock" && explicit !== "supabase") throw new Error(`Unsupported PIONEER_DATA_SOURCE: ${explicit}`);
    return explicit;
  }
  if (hasSupabaseEnv()) return "supabase";
  const serving = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  if (serving)
    throw new Error(
      "Supabase is not configured: set SUPABASE_URL and SUPABASE_ANON_KEY, or PIONEER_DATA_SOURCE=mock to run on fixtures.",
    );
  return "mock";
}

/*
 * Keep the selected service graph on globalThis during dev reloads so writes
 * and reads share one in-memory store.
 */
export function getServices(): WikiServices {
  const source = dataSource();
  if (!globalForServices.__pioneerServices) {
    globalForServices.__pioneerServices = source === "supabase" ? createSupabaseServices() : createMockServices();
  }
  return globalForServices.__pioneerServices;
}

export type { WikiServices } from "./contracts";
