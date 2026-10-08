import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `tools/seed-supabase.mjs` is the only path that turns `src/mock` into rows, and
 * nothing else compares it with the migrations: a renamed column, a dropped
 * `not null` or a wrong `check (… in …)` value would only surface against a live
 * project. This file runs the real script with a stub client, captures every
 * upsert, and checks the payloads against the schema parsed out of
 * `supabase/migrations`, so `pnpm test` covers the contract that would otherwise
 * need `supabase db reset` and a service-role key.
 */

interface Upsert {
  table: string;
  rows: Record<string, unknown>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

const upserts: Upsert[] = [];
const deletes: Array<{ table: string; column: string; value: unknown }> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }),
      upsert: async (
        rows: Record<string, unknown>[],
        options?: { onConflict?: string; ignoreDuplicates?: boolean },
      ) => {
        upserts.push({ table, rows, ...options });
        return { error: null };
      },
      delete: () => ({
        eq: async (column: string, value: unknown) => {
          deletes.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  }),
}));

interface Column {
  notNull: boolean;
  hasDefault: boolean;
  unique: boolean;
  values: readonly string[] | null;
  ref: { table: string; column: string } | null;
}

interface Table {
  columns: Map<string, Column>;
  /** Table-level `unique (a, b)` declarations, i.e. the seed's composite conflict targets. */
  compositeKeys: string[][];
}

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");

function parseColumn(rest: string): Column {
  const allowed = /check\s*\(\s*\w+\s+in\s*\(([^)]*)\)\s*\)/i.exec(rest);
  const target = /references\s+public\.(\w+)\s*\(\s*(\w+)\s*\)/i.exec(rest);
  return {
    notNull: /\bnot null\b/i.test(rest),
    hasDefault: /\bdefault\b/i.test(rest),
    unique: /\bunique\b/i.test(rest),
    values: allowed ? allowed[1].split(",").map((value) => value.trim().replace(/^'|'$/g, "")) : null,
    ref: target ? { table: target[1], column: target[2] } : null,
  };
}

function parseTable(body: string): Table {
  const columns = new Map<string, Column>();
  const compositeKeys: string[][] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const composite = /^unique\s*\(([^)]*)\)/i.exec(line);
    if (composite) {
      compositeKeys.push(composite[1].split(",").map((part) => part.trim()));
      continue;
    }
    if (/^(primary key|foreign key|constraint|check)\b/i.test(line)) continue;
    const matched = /^(\w+)\s+[a-z]+(?:\(\d+\))?(?:\[\])?(.*)$/i.exec(line);
    if (!matched) continue;
    const [, name, rest] = matched;
    columns.set(name, parseColumn(rest));
  }
  return { columns, compositeKeys };
}

async function readSchema(): Promise<Map<string, Table>> {
  const schema = new Map<string, Table>();
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS, file), "utf8");
    // Statements apply in file order, so a later `alter table` sees the tables created before it.
    for (const matched of sql.matchAll(
      /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);|alter table public\.(\w+)\s+(add column if not exists|alter column)\s+(\w+)\s+([^;]*);/g,
    )) {
      if (matched[1]) {
        schema.set(matched[1], parseTable(matched[2]));
        continue;
      }
      const [, , , table, action, column, rest] = matched;
      const declared = schema.get(table);
      if (!declared) continue;
      if (action.startsWith("add")) {
        declared.columns.set(column, parseColumn(rest.replace(/^[a-z]+(?:\(\d+\))?(?:\[\])?/i, "")));
      } else if (/drop not null/i.test(rest)) {
        const existing = declared.columns.get(column);
        if (existing) existing.notNull = false;
      }
    }
  }
  return schema;
}

/** Ids each table offers to foreign keys, keyed by the column a reference may target. */
function seededIds(): Map<string, Map<string, Set<string>>> {
  const ids = new Map<string, Map<string, Set<string>>>();
  for (const { table, rows } of upserts) {
    const byColumn = ids.get(table) ?? new Map<string, Set<string>>();
    for (const row of rows) {
      for (const [column, value] of Object.entries(row)) {
        if (typeof value !== "string") continue;
        const set = byColumn.get(column) ?? new Set<string>();
        set.add(value);
        byColumn.set(column, set);
      }
    }
    ids.set(table, byColumn);
  }
  return ids;
}

describe("seed ↔ migration contract", () => {
  let schema: Map<string, Table>;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://seed-contract.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-stub";
    vi.spyOn(console, "log").mockImplementation(() => {});
    await import("../../tools/seed-supabase.mjs");
    schema = await readSchema();
  });

  it("captures every upsert the seed performs", () => {
    const tables = new Set(upserts.map((upsert) => upsert.table));
    expect(tables.size, "seed wrote fewer tables than expected").toBeGreaterThanOrEqual(15);
    for (const table of ["authors", "sources", "tags", "assets", "entries", "entry_revisions", "members"]) {
      expect([...tables], `seed never wrote ${table}`).toContain(table);
    }
    expect(
      upserts.every((upsert) => upsert.rows.length > 0),
      "seed issued an empty upsert",
    ).toBe(true);
  });

  it("never overwrites existing rows or deletes live associations", () => {
    expect(upserts.every((operation) => operation.ignoreDuplicates === true)).toBe(true);
    expect(deletes).toEqual([]);
  });

  it("excludes example community content by default and imports complete entry snapshots", () => {
    expect(upserts.flatMap((operation) => operation.rows).some((row) => row.sample === true)).toBe(false);
    expect(upserts.some((operation) => operation.table === "forum_posts" || operation.table === "forum_threads")).toBe(
      false,
    );
    for (const row of upserts
      .filter((operation) => operation.table === "entry_revisions")
      .flatMap((operation) => operation.rows)) {
      expect(row.title_zh).toBeTruthy();
      expect(row.title_en).toBeTruthy();
      expect(row.metadata).toHaveProperty("sourceIds");
      expect(row.metadata).toHaveProperty("relationDrafts");
    }
  });

  it("only writes columns the migrations declare", () => {
    for (const { table, rows } of upserts) {
      const declared = schema.get(table)?.columns;
      expect(declared, `no migration creates public.${table}`).toBeDefined();
      for (const row of rows) {
        for (const column of Object.keys(row)) {
          expect(declared?.has(column), `${table}.${column} does not exist in the migrations`).toBe(true);
        }
      }
    }
  });

  it("fills every not-null column that has no default", () => {
    for (const { table, rows } of upserts) {
      const declared = schema.get(table);
      if (!declared) continue;
      const required = [...declared.columns]
        .filter(([, column]) => column.notNull && !column.hasDefault)
        .map(([name]) => name);
      for (const row of rows) {
        for (const column of required) {
          expect(row[column], `${table}.${column} is required but the seed left it empty`).not.toBeUndefined();
          expect(row[column], `${table}.${column} is required but the seed sent null`).not.toBeNull();
        }
      }
    }
  });

  it("keeps check (… in …) values inside their allowed set", () => {
    for (const { table, rows } of upserts) {
      const declared = schema.get(table);
      if (!declared) continue;
      for (const [name, column] of declared.columns) {
        if (!column.values) continue;
        for (const row of rows) {
          const value = row[name];
          if (value === undefined || value === null) continue;
          expect(column.values, `${table}.${name} = ${String(value)} is outside ${column.values.join("|")}`).toContain(
            String(value),
          );
        }
      }
    }
  });

  it("keeps unique and composite keys free of duplicates", () => {
    for (const { table, rows } of upserts) {
      const declared = schema.get(table);
      if (!declared) continue;
      const unique = [...declared.columns].filter(([, column]) => column.unique).map(([name]) => name);
      for (const column of unique) {
        const seen = rows.map((row) => row[column]).filter((value) => value !== undefined && value !== null);
        expect(new Set(seen).size, `${table}.${column} repeats a value`).toBe(seen.length);
      }
      for (const key of declared.compositeKeys) {
        const seen = rows.map((row) => key.map((column) => String(row[column])).join("\u0000"));
        expect(new Set(seen).size, `${table} repeats (${key.join(", ")})`).toBe(seen.length);
      }
    }
  });

  it("points every foreign key at a row seeded in the same run", () => {
    const ids = seededIds();
    for (const { table, rows } of upserts) {
      const declared = schema.get(table);
      if (!declared) continue;
      for (const [name, column] of declared.columns) {
        if (!column.ref || !ids.has(column.ref.table)) continue;
        const available = ids.get(column.ref.table)?.get(column.ref.column) ?? new Set<string>();
        for (const row of rows) {
          const value = row[name];
          if (value === undefined || value === null) continue;
          expect(
            available,
            `${table}.${name} = ${String(value)} has no ${column.ref.table}.${column.ref.column}`,
          ).toContain(String(value));
        }
      }
    }
  });

  it("names existing columns in every onConflict target", () => {
    for (const { table, onConflict } of upserts) {
      if (!onConflict) continue;
      const declared = schema.get(table);
      for (const column of onConflict.split(",").map((part) => part.trim())) {
        expect(declared?.columns.has(column), `${table} conflicts on unknown column ${column}`).toBe(true);
      }
    }
  });
});
