import { vi } from "vitest";

/*
 * A stand-in for the Supabase client: every query builder method records its
 * call and returns the builder, awaiting it yields the next answer queued for
 * that table, and rpc() answers by function name. Tests assert on what was
 * asked, not on how the adapter is written.
 */

type Answer = { data: unknown; error: { message: string; code?: string } | null; count?: number };

export function supabaseStub(tables: Record<string, Answer[] | Answer> = {}, rpcs: Record<string, Answer | ((args: unknown) => Answer)> = {}) {
  const calls: Array<{ table: string; chain: Array<[string, ...unknown[]]> }> = [];
  const rpcCalls: Array<[string, unknown]> = [];
  const queue = (table: string): Answer => {
    const entry = tables[table];
    if (Array.isArray(entry)) return entry.length > 1 ? entry.shift()! : (entry[0] ?? { data: [], error: null });
    return entry ?? { data: [], error: null };
  };
  const from = vi.fn((table: string) => {
    const chain: Array<[string, ...unknown[]]> = [];
    calls.push({ table, chain });
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "is", "not", "in", "or", "order", "limit", "range", "gte", "lte", "lt", "gt", "contains", "maybeSingle", "single", "update", "insert", "upsert", "delete"])
      builder[method] = (...args: unknown[]) => {
        chain.push([method, ...args]);
        return builder;
      };
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(queue(table)).then(resolve, reject);
    return builder;
  });
  const rpc = vi.fn(async (name: string, args: unknown) => {
    rpcCalls.push([name, args]);
    const answer = rpcs[name];
    return typeof answer === "function" ? answer(args) : (answer ?? { data: null, error: null });
  });
  const client = { from, rpc, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } };
  return { client, calls, rpcCalls };
}
