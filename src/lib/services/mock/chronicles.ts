import { ServiceError, type ChroniclePatch, type ChronicleRepository } from "@/lib/services/contracts";
import type { Chronicle, ChronicleDetail } from "@/lib/model/types";
import { CHRONICLE_KIND_IDS } from "@/lib/model/vocab";
import { facetsOf, matchesChronicle, newestFirst } from "@/lib/chronicles/query";
import { chronicles } from "@/mock/chronicles";
import { createMockContext, paginate, type MockContext } from "./context";

/*
 * In-memory annals store, newest first. The mock keeps one deep copy and hands
 * out copies, so a caller can never reach into `src/mock` or the store and
 * mutate it. Every filter, the search included, runs over the whole register
 * before `offset` and `limit` cut a page; the 200-record default matches the
 * Supabase adapter's page size. Archived records leave every public read.
 */

const HTTP_URL = /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/\S*)?$/i;

function checkPatch(patch: ChroniclePatch) {
  const pair = (value: { zh: string; en: string } | undefined, max: number) =>
    !value || (value.zh.trim().length >= 1 && value.en.trim().length >= 1 && value.zh.length <= max && value.en.length <= max);
  if (!pair(patch.title, 120)) throw new ServiceError("invalid", "invalid_chronicle_title");
  if (!pair(patch.summary, 400)) throw new ServiceError("invalid", "invalid_chronicle_summary");
  if (patch.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) throw new ServiceError("invalid", "invalid_chronicle_date");
  if (patch.kind !== undefined && !CHRONICLE_KIND_IDS.includes(patch.kind)) throw new ServiceError("invalid", "invalid_chronicle_kind");
  if (patch.body && patch.body.length > 40000) throw new ServiceError("invalid", "invalid_chronicle_body");
  if (patch.resources?.some((r) => !HTTP_URL.test(r.url) || !r.label.zh.trim() || !r.label.en.trim()))
    throw new ServiceError("invalid", "invalid_chronicle_resources");
  if (patch.tags && (patch.tags.length > 12 || patch.tags.some((t) => !t.trim() || t.length > 32)))
    throw new ServiceError("invalid", "invalid_chronicle_tags");
}

export function createMockChronicleRepository(
  fixtures: ChronicleDetail[] = chronicles,
  context: MockContext = createMockContext(() => null),
  memberIds: () => string[] = () => [],
): ChronicleRepository {
  const records: ChronicleDetail[] = structuredClone(fixtures)
    .map((record) => ({ ...record, version: record.version ?? 1 }))
    .sort(newestFirst);
  const visible = () => records.filter((record) => !record.archivedAt);
  // The list carries no account: like the Supabase list, it never reads the bodies out.
  const summary = (record: ChronicleDetail): Chronicle => {
    const copy = structuredClone(record);
    delete copy.body;
    return copy;
  };

  return {
    async listChronicles(query) {
      const offset = query?.offset ?? 0;
      return visible()
        .filter((record) => matchesChronicle(record, query))
        .slice(offset, offset + (query?.limit ?? 200))
        .map(summary);
    },

    async countChronicles(query) {
      return visible().filter((record) => matchesChronicle(record, query)).length;
    },

    async chronicleFacets() {
      return facetsOf(visible());
    },

    async adjacentChronicles(id) {
      const list = visible();
      const at = list.findIndex((record) => record.id === id);
      if (at < 0) return { older: null, newer: null };
      const older = list[at + 1];
      const newer = list[at - 1];
      return { older: older ? summary(older) : null, newer: newer ? summary(newer) : null };
    },

    async getChronicle(id, query) {
      const found = records.find((record) => record.id === id && (query?.includeArchived || !record.archivedAt));
      return found ? structuredClone(found) : null;
    },

    async listForAdmin(query = {}) {
      context.requireActive(true);
      const view = query.view ?? "active";
      const rows = records
        .filter((record) => view === "all" || (view === "archived") === Boolean(record.archivedAt))
        .filter((record) => matchesChronicle(record, { q: query.q }))
        .map((record) => structuredClone(record));
      return paginate(rows, query.limit, query.offset);
    },

    async saveChronicle(id, patch, baseVersion) {
      context.requireActive(true);
      checkPatch(patch);
      const members = memberIds();
      if (members.length && patch.hostIds?.some((host) => !members.includes(host)))
        throw new ServiceError("invalid", "unknown_chronicle_host");
      let record: ChronicleDetail;
      if (!id) {
        if (!patch.title || !patch.summary || !patch.date || !patch.kind) throw new ServiceError("invalid", "chronicle_incomplete");
        const number = Math.max(0, ...records.map((r) => r.number)) + 1;
        record = {
          id: `ch-${String(number).padStart(4, "0")}`,
          number,
          date: patch.date,
          kind: patch.kind,
          title: patch.title,
          summary: patch.summary,
          body: patch.body ?? undefined,
          hostIds: patch.hostIds ?? [],
          resources: patch.resources ?? [],
          gallery: [],
          tags: patch.tags ?? [],
          sample: patch.sample ?? false,
          version: 1,
        };
        records.push(record);
      } else {
        const at = records.findIndex((r) => r.id === id);
        if (at < 0) throw new ServiceError("invalid", "chronicle_not_found");
        if (baseVersion !== undefined && baseVersion !== records[at].version) throw new ServiceError("conflict", "version_conflict");
        record = {
          ...records[at],
          ...patch,
          body: patch.body === null ? undefined : (patch.body ?? records[at].body),
          version: (records[at].version ?? 1) + 1,
        };
        records[at] = record;
      }
      records.sort(newestFirst);
      context.audit(id ? "update" : "create", "chronicle", record.id, null, { version: record.version });
      return structuredClone(record);
    },

    async setChronicleArchived(id, archived, reason) {
      context.requireActive(true);
      const record = records.find((r) => r.id === id);
      if (!record) throw new ServiceError("invalid", "chronicle_not_found");
      if (Boolean(record.archivedAt) === archived) throw new ServiceError("conflict", "unchanged_status");
      record.archivedAt = archived ? new Date().toISOString() : undefined;
      record.version = (record.version ?? 1) + 1;
      context.audit(archived ? "archive" : "restore", "chronicle", id, null, { reason: reason ?? null });
      return structuredClone(record);
    },
  };
}
