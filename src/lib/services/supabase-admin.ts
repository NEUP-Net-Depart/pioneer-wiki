import "server-only";
import type { AccountRecord, AssetRecord, AuditEvent, IdentityApplication, Localized } from "@/lib/model/types";
import type {
  AccountRepository,
  AdminTodo,
  AssetDetails,
  AuditRepository,
  OperationsAdapter,
  ReferenceRepository,
} from "./contracts";
import { ServiceError } from "./contracts";
import { createSupabaseAuthAdapter } from "./supabase-auth";
import {
  bool,
  client,
  jsonList,
  mapAsset,
  mapAuthor,
  mapSource,
  mapTag,
  number,
  optionalText,
  result,
  rpc,
  text,
  type Row,
} from "./supabase-shared";

/** The schema this build expects; pw_ready() answers with the migration it was created by. */
export const EXPECTED_SCHEMA = "202610140004";

const pageOf = <T>(payload: { total?: unknown; rows?: unknown }, map: (row: Row) => T) => ({
  total: number(payload.total),
  rows: jsonList<Row>(payload.rows).map(map),
});

function mapApplication(row: Row): IdentityApplication {
  const account = row.account as Row | null | undefined;
  return {
    id: text(row.id),
    accountId: optionalText(row.accountId ?? row.account_id),
    kind: row.kind as IdentityApplication["kind"],
    statement: text(row.statement),
    proposedHandle: optionalText(row.proposedHandle ?? row.proposed_handle),
    status: row.status as IdentityApplication["status"],
    decisionReason: optionalText(row.decisionReason ?? row.decision_reason),
    decidedAt: optionalText(row.decidedAt ?? row.decided_at),
    createdAt: text(row.createdAt ?? row.created_at),
    account: account
      ? {
          handle: text(account.handle),
          email: text(account.email),
          name: account.name as Localized,
          authorId: optionalText(account.authorId),
          memberId: optionalText(account.memberId),
          status: (optionalText(account.status) ?? "active") as "active",
        }
      : undefined,
  };
}

function mapAccountRecord(row: Row): AccountRecord {
  return {
    id: text(row.id),
    email: text(row.email),
    handle: text(row.handle),
    name: row.name as Localized,
    role: row.role === "admin" ? "admin" : "reader",
    status: (optionalText(row.status) ?? "active") as AccountRecord["status"],
    statusReason: optionalText(row.statusReason),
    emailVerified: bool(row.emailVerified),
    authorId: optionalText(row.authorId),
    authorName: (row.authorName as Localized | null) ?? undefined,
    memberId: optionalText(row.memberId),
    memberHandle: optionalText(row.memberHandle),
    memberName: (row.memberName as Localized | null) ?? undefined,
    memberArchived: bool(row.memberArchived),
    closureRequestedAt: optionalText(row.closureRequestedAt),
    closedAt: optionalText(row.closedAt),
    pendingApplicationId: optionalText(row.pendingApplicationId),
    createdAt: text(row.createdAt),
    lastSignInAt: optionalText(row.lastSignInAt),
  };
}

export function createAccountRepository(): AccountRepository {
  const auth = createSupabaseAuthAdapter();
  return {
    async updateOwnProfile(name) {
      return rpc<Localized>("pw_update_own_profile", { p_name_zh: name.zh, p_name_en: name.en });
    },
    async requestClosure(reason) {
      const row = await rpc<Row>("pw_request_account_closure", { p_reason: reason ?? null });
      return { requestedAt: optionalText(row.requestedAt) ?? null };
    },
    async cancelClosure() {
      await rpc("pw_cancel_account_closure");
    },
    async listOwnApplications() {
      const account = await auth.getCurrentAccount();
      if (!account) return [];
      const c = await client();
      const rows = (await result(
        await c
          .from("identity_applications")
          .select("*")
          .eq("account_id", account.id)
          .order("created_at", { ascending: false })
          .limit(20),
      )) as Row[];
      return rows.map(mapApplication);
    },
    async submitApplication(input) {
      return mapApplication(
        await rpc<Row>("pw_submit_application", {
          p_kind: input.kind,
          p_statement: input.statement,
          p_handle: input.handle ?? null,
        }),
      );
    },
    async withdrawApplication(id) {
      return mapApplication(await rpc<Row>("pw_withdraw_application", { p_id: id }));
    },
    async todo() {
      return rpc<AdminTodo>("pw_admin_todo");
    },
    async listAccounts(query = {}) {
      return pageOf(
        await rpc<Row>("pw_admin_list_accounts", {
          p_text: query.text ?? "",
          p_status: query.status ?? [],
          p_role: query.role ?? [],
          p_flag: query.flag ?? null,
          p_limit: query.limit ?? 25,
          p_offset: query.offset ?? 0,
        }),
        mapAccountRecord,
      );
    },
    async setRole(id, role, reason) {
      await rpc("pw_admin_set_role", { p_target: id, p_role: role, p_reason: reason ?? null });
    },
    async setStatus(id, status, reason) {
      await rpc("pw_admin_set_status", { p_target: id, p_status: status, p_reason: reason ?? null });
    },
    async setIdentity(id, patch, reason) {
      await rpc("pw_admin_set_identity", { p_target: id, p_patch: patch, p_reason: reason ?? null });
    },
    async closeAccount(id, note) {
      await rpc("pw_admin_close_account", { p_target: id, p_note: note ?? null });
    },
    async listApplications(query = {}) {
      return pageOf(
        await rpc<Row>("pw_admin_list_applications", {
          p_status: query.status ?? ["pending"],
          p_limit: query.limit ?? 25,
          p_offset: query.offset ?? 0,
        }),
        mapApplication,
      );
    },
    async decideApplication(id, decision, input) {
      return mapApplication(
        await rpc<Row>("pw_admin_decide_application", {
          p_id: id,
          p_decision: decision,
          p_reason: input.reason ?? null,
          p_author: input.author ?? null,
          p_member: input.member ?? null,
        }),
      );
    },
  };
}

export function createAuditRepository(): AuditRepository {
  return {
    async listAudit(query = {}) {
      return pageOf(
        await rpc<Row>("pw_admin_list_audit", {
          p_object_type: query.objectType ?? null,
          p_object_id: query.objectId ?? null,
          p_action: query.action ?? null,
          p_limit: query.limit ?? 50,
          p_offset: query.offset ?? 0,
        }),
        (row): AuditEvent => ({
          id: number(row.id),
          action: text(row.action),
          objectType: text(row.objectType),
          objectId: text(row.objectId),
          actorId: optionalText(row.actorId),
          actorHandle: optionalText(row.actorHandle),
          actorName: (row.actorName as Localized | null) ?? undefined,
          before: row.before ?? null,
          after: row.after ?? null,
          createdAt: text(row.createdAt),
        }),
      );
    },
  };
}

function mapAssetRecord(row: Row): AssetRecord {
  return {
    ...mapAsset(row),
    reviewStatus: (optionalText(row.review_status) ?? "pending") as AssetRecord["reviewStatus"],
    reviewNote: optionalText(row.review_note),
    ownerHandle: optionalText(row.owner_handle),
    createdAt: text(row.created_at),
    usedBy: jsonList<Row>(row.usedBy).map((use) => ({
      id: text(use.id),
      slug: text(use.slug),
      published: bool(use.published),
    })),
  };
}

const detailsArgs = (details: AssetDetails | undefined) => (details ? { ...details } : null);

export function createReferenceRepository(): ReferenceRepository {
  const auth = createSupabaseAuthAdapter();
  return {
    async listAuthors() {
      const c = await client();
      return ((await result(await c.from("authors").select("*").order("id"))) as Row[]).map(mapAuthor);
    },
    async listSources() {
      const c = await client();
      return ((await result(await c.from("sources").select("*").order("id"))) as Row[]).map(mapSource);
    },
    async listTags() {
      const c = await client();
      return ((await result(await c.from("tags").select("*").order("id"))) as Row[]).map(mapTag);
    },
    async listAssets() {
      const [c, account] = await Promise.all([client(), auth.getCurrentAccount()]);
      let request = c.from("assets").select("*");
      request = account
        ? request.or(`review_status.eq.approved,owner_id.eq.${account.id}`)
        : request.eq("review_status", "approved");
      return ((await result(await request.order("id"))) as Row[]).map(mapAsset);
    },
    async getAsset(id) {
      const c = await client();
      const row = (await result(
        await c.from("assets").select("*").eq("id", id).eq("review_status", "approved").maybeSingle(),
      )) as Row | null;
      return row ? mapAsset(row) : null;
    },
    async listAssetsForReview(query = {}) {
      return pageOf(
        await rpc<Row>("pw_admin_list_assets", {
          p_status: query.status ?? ["pending"],
          p_text: query.text ?? "",
          p_limit: query.limit ?? 24,
          p_offset: query.offset ?? 0,
        }),
        mapAssetRecord,
      );
    },
    async reviewAsset(id, decision, note, details) {
      return mapAssetRecord({
        ...(await rpc<Row>("pw_admin_review_asset", {
          p_id: id,
          p_decision: decision,
          p_note: note ?? null,
          p_details: detailsArgs(details),
        })),
        usedBy: [],
      });
    },
    async updateAssetDetails(id, details) {
      return mapAsset(await rpc<Row>("pw_update_asset_details", { p_id: id, p_details: detailsArgs(details) }));
    },
    async listOrphanFiles() {
      return jsonList<Row>(await rpc("pw_admin_orphan_objects")).map((row) => ({
        bucket: text(row.bucket),
        name: text(row.name),
        createdAt: text(row.createdAt),
        size: row.size == null ? undefined : number(row.size),
      }));
    },
    async removeOrphanFile(bucket, name) {
      // Only what the database still lists as unreferenced may go.
      const orphans = await this.listOrphanFiles();
      if (!orphans.some((file) => file.bucket === bucket && file.name === name))
        throw new ServiceError("conflict", "file_in_use");
      const c = await client();
      const { error } = await c.storage.from(bucket).remove([name]);
      if (error) throw new ServiceError("unavailable", "unavailable");
    },
    async uploadEntryAsset(image, details) {
      await rpc("pw_upload_allowance", { p_kind: "entry" });
      const c = await client();
      const stored = await c.storage
        .from("entry-assets")
        .upload(image.name, image.data, { contentType: "image/webp", upsert: false });
      if (stored.error) throw new ServiceError("unavailable", "upload_failed");
      try {
        return mapAsset(
          await rpc<Row>("pw_register_entry_asset", {
            p_object_path: image.name,
            p_width: image.width,
            p_height: image.height,
            p_details: detailsArgs(details),
          }),
        );
      } catch (error) {
        // No record, no file: the upload leaves nothing behind.
        await c.storage.from("entry-assets").remove([image.name]);
        throw error;
      }
    },
    async readAssetFile(id) {
      const c = await client();
      const row = (await result(
        await c.from("assets").select("bucket, object_path, review_status").eq("id", id).maybeSingle(),
      )) as Row | null;
      const bucket = optionalText(row?.bucket);
      const path = optionalText(row?.object_path);
      if (!row || !bucket || !path) return null;
      const { data, error } = await c.storage.from(bucket).download(path);
      if (error || !data) return null;
      return { data: Buffer.from(await data.arrayBuffer()), cacheable: row.review_status === "approved" };
    },
  };
}

export function createOperationsAdapter(): OperationsAdapter {
  return {
    async ready() {
      try {
        const payload = await rpc<Row>("pw_ready");
        const schema = optionalText(payload.schema);
        return schema === EXPECTED_SCHEMA ? { ok: true, schema } : { ok: false, schema, reason: "schema_mismatch" };
      } catch {
        return { ok: false, reason: "database_unreachable" };
      }
    },
  };
}
