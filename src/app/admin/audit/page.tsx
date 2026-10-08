import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { DeskHead, EmptyDrawer, formatWhen, Ledger, LedgerRow, Pager, ReadFailure, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";

export const metadata: Metadata = { title: "审计 Audit" };

const LIMIT = 50;
const TYPES = ["entry", "profile", "application", "author", "member", "link", "chronicle", "thread", "post", "asset", "family", "category"];

/** The values that changed between two recorded states, as readable lines. */
function changes(before: unknown, after: unknown): Array<[string, string, string]> {
  const a = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const b = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const show = (value: unknown) => (value === undefined || value === null ? "—" : typeof value === "string" ? value : JSON.stringify(value));
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .slice(0, 24)
    .map((key) => [key, show(a[key]).slice(0, 240), show(b[key]).slice(0, 240)]);
}

/** Who did what to which record, newest first; each event opens to the values that changed. */
export default async function AdminAudit({ searchParams }: PageProps<"/admin/audit">) {
  const lang = await getLang();
  const params = await searchParams;
  const type = typeof params.type === "string" && TYPES.includes(params.type) ? params.type : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const page = await getServices()
    .audit.listAudit({ objectType: type || undefined, objectId: q || undefined, limit: LIMIT, offset })
    .catch(() => null);
  return (
    <>
      <DeskHead
        kicker="Audit log"
        title={tr(lang, "审计", "Audit log")}
        lede={tr(
          lang,
          "每一项管理与写入操作都在同一事务中留下记录：操作者、动作、对象、时间与改动的字段。审计不记录密码、令牌或邮箱。",
          "Every administrative and editorial write leaves a record in the same transaction: actor, action, object, time and the fields changed. No passwords, tokens or email addresses are recorded.",
        )}
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "对象编号，如 PW-0012", "Object id, e.g. PW-0012") }}
        textLabel={tr(lang, "对象", "Object")}
        filters={[
          {
            name: "type",
            label: tr(lang, "对象类型", "Object type"),
            value: type,
            options: [["", tr(lang, "全部", "All")], ...TYPES.map((value) => [value, value] as [string, string])],
          },
        ]}
      />
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的审计记录。", "No audit events match.")} />
      ) : (
        <>
          <Ledger label={tr(lang, "审计记录", "Audit events")}>
            {page.rows.map((event) => {
              const diff = changes(event.before, event.after);
              return (
                <LedgerRow key={event.id} className="md:grid-cols-[11rem_minmax(0,1fr)]">
                  <time dateTime={event.createdAt} className="font-mono text-meta text-ink-3">
                    {formatWhen(event.createdAt, lang)}
                  </time>
                  <div className="min-w-0">
                    <p className="text-small text-ink">
                      <span className="font-medium">{event.actorName?.[lang] ?? event.actorHandle ?? tr(lang, "系统", "system")}</span>{" "}
                      <span className="font-mono text-ink-2">{event.action}</span>{" "}
                      <span className="font-mono text-meta break-all text-ink-3">
                        {event.objectType}:{event.objectId}
                      </span>
                    </p>
                    {diff.length ? (
                      <details className="mt-1 text-meta">
                        <summary className="pw-link min-h-8 cursor-pointer text-ink-2">{tr(lang, `${diff.length} 处改动`, `${diff.length} changes`)}</summary>
                        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_1fr_1fr]">
                          {diff.map(([key, was, now]) => (
                            <div key={key} className="contents">
                              <dt className="font-mono text-ink-3">{key}</dt>
                              <dd className="break-all text-ink-3 line-through decoration-brick/40">{was}</dd>
                              <dd className="break-all text-ink">{now}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                  </div>
                </LedgerRow>
              );
            })}
          </Ledger>
          <Pager lang={lang} path="/admin/audit" params={{ type, q }} offset={offset} limit={LIMIT} total={page.total} />
        </>
      )}
    </>
  );
}
