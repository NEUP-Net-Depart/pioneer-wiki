import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * The editorial office's printed furniture: a page head, ledger rows that
 * read as a table on wide screens and as cards on narrow ones, a pager, state
 * tags (text + glyph + tone, never colour alone) and the empty drawer.
 * Server components; they carry no behaviour.
 */

type Lang = "zh" | "en";
export const tr = (lang: Lang, zh: string, en: string) => (lang === "zh" ? zh : en);

export function DeskHead({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker: string;
  title: string;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-3xl">
        <p className="font-mono text-meta tracking-[0.14em] text-brick-ink uppercase">{kicker}</p>
        <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] tracking-[-0.01em] text-balance">
          {title}
        </h1>
        {lede ? <div className="mt-4 max-w-prose text-small leading-relaxed text-ink-2">{lede}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-x-6 gap-y-3">{actions}</div> : null}
    </header>
  );
}

/** A ruled list of records. Each row lays its cells out as columns from `md` up. */
export function Ledger({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={cn("pw-sheet divide-y divide-rule", className)}>
      {children}
    </ul>
  );
}

export function LedgerRow({
  children,
  className,
  muted,
}: {
  children: React.ReactNode;
  className?: string;
  /** Archived or hidden records are set back, never removed from view. */
  muted?: boolean;
}) {
  return (
    <li className={cn("grid gap-x-6 gap-y-2 px-4 py-4 sm:px-6", muted && "bg-paper-deep/40", className)}>{children}</li>
  );
}

/** A small typed label in front of a value on narrow screens, hidden where columns have headings. */
export function CellLabel({ children }: { children: React.ReactNode }) {
  return <span className="pw-label mr-2 md:sr-only">{children}</span>;
}

export type Tone = "neutral" | "ok" | "pending" | "warn" | "danger" | "quiet";
const TONES: Record<Tone, string> = {
  neutral: "text-ink-2 border-rule-strong",
  ok: "text-moss-ink border-moss/50",
  pending: "text-indigo border-indigo/40",
  warn: "text-gold-ink border-gold/60",
  danger: "text-brick-ink border-brick/50",
  quiet: "text-ink-3 border-rule",
};
const GLYPHS: Record<Tone, string> = { neutral: "·", ok: "✓", pending: "◷", warn: "!", danger: "✕", quiet: "–" };

export function StateTag({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-xs border px-1.5 py-0.5 text-meta font-medium whitespace-nowrap",
        TONES[tone],
      )}
    >
      <span aria-hidden="true" className="font-mono">
        {GLYPHS[tone]}
      </span>
      {children}
    </span>
  );
}

/** Previous / next with the record range, keeping every other query parameter. */
export function Pager({
  lang,
  path,
  params,
  offset,
  limit,
  total,
}: {
  lang: Lang;
  path: string;
  params: Record<string, string | undefined>;
  offset: number;
  limit: number;
  total: number;
}) {
  if (total <= limit && offset === 0) return null;
  const href = (next: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    if (next > 0) query.set("offset", String(next));
    const search = query.toString();
    return search ? `${path}?${search}` : path;
  };
  const from = total ? offset + 1 : 0;
  const to = Math.min(total, offset + limit);
  return (
    <nav
      aria-label={tr(lang, "分页", "Pages")}
      className="pw-ink-over flex flex-wrap items-center justify-between gap-4 text-small text-ink-2"
    >
      <span className="font-mono text-meta text-ink-3">
        {tr(lang, `第 ${from}–${to} 条，共 ${total} 条`, `${from}–${to} of ${total}`)}
      </span>
      <span className="flex gap-6">
        {offset > 0 ? (
          <Link className="pw-link min-h-11 py-3" href={href(Math.max(0, offset - limit))}>
            ← {tr(lang, "上一页", "Previous")}
          </Link>
        ) : null}
        {to < total ? (
          <Link className="pw-link min-h-11 py-3" href={href(offset + limit)}>
            {tr(lang, "下一页", "Next")} →
          </Link>
        ) : null}
      </span>
    </nav>
  );
}

/** An empty drawer: says what is missing and, when there is one, the next step. */
export function EmptyDrawer({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="pw-card flex flex-col items-start gap-2 px-6 pt-16 pb-12 text-small text-ink-2 sm:px-8">
      <p className="font-mono text-meta tracking-[0.14em] text-ink-3 uppercase">Empty drawer</p>
      <p className="font-display text-h4 text-ink">{title}</p>
      {children ? <div className="max-w-prose leading-relaxed">{children}</div> : null}
    </div>
  );
}

/** A failure to read, said as such — never shown as an empty list. */
export function ReadFailure({ lang, reason }: { lang: Lang; reason?: string }) {
  return (
    <div role="alert" className="pw-sheet border-brick/40 p-6 text-small text-brick-ink">
      <p className="font-display text-h4">{tr(lang, "没能读取这份清单。", "This list could not be read.")}</p>
      <p className="mt-2 text-ink-2">
        {tr(
          lang,
          "数据服务暂时没有响应。刷新页面重试；如果持续出现，请检查服务的就绪状态（/api/health/ready）。",
          "The data service did not answer. Refresh to retry; if it persists, check readiness at /api/health/ready.",
        )}
        {reason ? <span className="ml-1 font-mono text-meta">({reason})</span> : null}
      </p>
    </div>
  );
}

export function formatWhen(value: string | undefined, lang: Lang): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "zh" ? "zh-CN" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
