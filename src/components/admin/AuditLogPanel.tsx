"use client";

import { useEffect, useState } from "react";

type AuditRow = {
  id: number;
  action: string;
  object_type: string;
  object_id: string;
  actor_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
};

export function AuditLogPanel({ lang }: { lang: "zh" | "en" }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/api/admin/audit")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`);
        setRows(payload.logs ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);
  if (error)
    return (
      <p role="alert" className="pw-sheet p-5 text-small text-brick-ink">
        {error}
      </p>
    );
  if (!rows)
    return (
      <p className="pw-sheet p-5 text-small text-ink-3">{lang === "zh" ? "正在读取审计记录…" : "Loading audit log…"}</p>
    );
  if (!rows.length)
    return (
      <p className="pw-sheet p-5 text-small text-ink-3">
        {lang === "zh" ? "还没有审计记录。" : "No audit events yet."}
      </p>
    );
  return (
    <div className="pw-sheet overflow-x-auto">
      <table className="w-full min-w-[42rem] text-left text-small">
        <thead className="border-b border-rule text-meta text-ink-3">
          <tr>
            <th className="px-4 py-3 font-normal">{lang === "zh" ? "时间" : "Time"}</th>
            <th className="px-4 py-3 font-normal">{lang === "zh" ? "动作" : "Action"}</th>
            <th className="px-4 py-3 font-normal">{lang === "zh" ? "对象" : "Object"}</th>
            <th className="px-4 py-3 font-normal">{lang === "zh" ? "操作者" : "Actor"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-rule last:border-0">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-meta text-ink-3">
                {new Date(row.created_at).toLocaleString(lang === "zh" ? "zh-CN" : "en-GB")}
              </td>
              <td className="px-4 py-3 text-ink">{row.action}</td>
              <td className="px-4 py-3 font-mono text-meta text-ink-2">
                {row.object_type}:{row.object_id}
              </td>
              <td className="px-4 py-3 font-mono text-meta text-ink-3">{row.actor_id ?? "system"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
