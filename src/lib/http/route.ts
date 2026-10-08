import "server-only";
import { NextResponse } from "next/server";
import type { Account } from "@/lib/model/types";
import { getServices } from "@/lib/services";
import { ServiceError } from "@/lib/services/contracts";
import { asServiceError, errorBody, HTTP_STATUS } from "@/lib/services/errors";
import { getLang } from "@/lib/i18n/server";

/*
 * Route handler plumbing: one way to read a body, one way to check who is
 * asking, one way to answer a failure. Handlers throw ServiceError; `handle`
 * turns it into the status and bilingual body, and logs only what is
 * unexpected — with the reason code, never the request body or a secret.
 */

export async function failure(error: unknown): Promise<NextResponse> {
  const serviceError = asServiceError(error);
  if (serviceError.code === "unavailable") {
    console.error(
      JSON.stringify({
        level: "error",
        event: "request_failed",
        reason: serviceError.reason,
        cause: error instanceof ServiceError ? undefined : error instanceof Error ? error.name : typeof error,
        at: new Date().toISOString(),
      }),
    );
  }
  let lang: "zh" | "en" = "zh";
  try {
    lang = await getLang();
  } catch {
    // Outside a request scope (tests), answer in the default language.
  }
  return NextResponse.json(errorBody(serviceError, lang), { status: HTTP_STATUS[serviceError.code] });
}

/** Runs a handler and answers any thrown failure in the shared shape. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    return failure(error);
  }
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") throw new Error("not an object");
    return value as T;
  } catch {
    throw new ServiceError("invalid", "invalid_payload");
  }
}

export interface Gate {
  /** Default true: the email must be verified. */
  verified?: boolean;
  /** The account must be bound to a wiki author (administrators always may write). */
  author?: boolean;
  admin?: boolean;
}

/** The signed-in account allowed through `gate`, or a ServiceError explaining the next step. */
export async function requireAccount(gate: Gate = {}): Promise<Account> {
  const account = await getServices().auth.getCurrentAccount();
  if (!account) throw new ServiceError("unauthenticated", "unauthenticated");
  if (account.status === "closed") throw new ServiceError("forbidden", "account_closed");
  if (account.status === "suspended") throw new ServiceError("forbidden", "account_suspended");
  if (gate.verified !== false && !account.emailVerified) throw new ServiceError("forbidden", "email_not_verified");
  if (gate.admin && account.role !== "admin") throw new ServiceError("forbidden", "admin_required");
  if (gate.author && !account.authorId && account.role !== "admin")
    throw new ServiceError("forbidden", "author_required");
  return account;
}

/** Lets a handler answer 404 when a lookup resolves null. */
export function notFound(reason = "not_found"): never {
  throw new ServiceError("not_found", reason);
}

export function ok<T>(value: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json(value, typeof init === "number" ? { status: init } : init);
}
