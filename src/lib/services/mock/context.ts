import type { Account, AssetRecord, AuditEvent, Author, Source, Tag } from "@/lib/model/types";
import { authors, sources, tags } from "@/mock/people";
import { assets } from "@/mock/assets";
import { ServiceError } from "@/lib/services/contracts";

/*
 * State the in-memory repositories share: who is signed in, the reference
 * records publishing can add to, the images and the audit log. One context
 * per service graph, so tests that build their own graph start clean.
 */

export interface MockAsset extends AssetRecord {
  ownerId?: string;
  /** Local file name for uploads; fixtures are files under public/. */
  file?: string;
}

export interface MockContext {
  account(): Account | null;
  authors: Author[];
  sources: Source[];
  tags: Tag[];
  assets: MockAsset[];
  auditLog: AuditEvent[];
  audit(action: string, objectType: string, objectId: string, before?: unknown, after?: unknown): void;
  /** Throws like the database guards: an active, verified account, optionally an administrator. */
  requireActive(admin?: boolean): Account;
}

export function createMockContext(account: () => Account | null): MockContext {
  const auditLog: AuditEvent[] = [];
  const context: MockContext = {
    account,
    authors: structuredClone(authors),
    sources: structuredClone(sources),
    tags: structuredClone(tags),
    assets: assets.map((asset) => ({
      ...structuredClone(asset),
      reviewStatus: "approved",
      createdAt: "2026-10-01T00:00:00+08:00",
      usedBy: [],
    })),
    auditLog,
    audit(action, objectType, objectId, before = null, after = null) {
      const actor = account();
      auditLog.unshift({
        id: auditLog.length + 1,
        action,
        objectType,
        objectId,
        actorId: actor?.id,
        actorHandle: actor?.handle,
        actorName: actor?.name,
        before,
        after,
        createdAt: new Date().toISOString(),
      });
    },
    requireActive(admin = false) {
      const current = account();
      if (!current || current.status === "closed") throw new ServiceError("forbidden", "account_required");
      if (current.status === "suspended" || !current.emailVerified)
        throw new ServiceError("forbidden", "verified_account_required");
      if (admin && current.role !== "admin") throw new ServiceError("forbidden", "admin_required");
      return current;
    },
  };
  return context;
}

/** One page of rows, the way the database lists them. */
export function paginate<T>(rows: T[], limit = 25, offset = 0) {
  const start = Math.max(0, offset);
  return { rows: rows.slice(start, start + Math.max(1, Math.min(limit, 200))), total: rows.length };
}
