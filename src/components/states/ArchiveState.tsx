import { cn } from "@/lib/utils";

/*
 * One look for every non-content state: loading, empty, error, not found —
 * written on a library catalogue card. Each state is expressed by text, a
 * glyph (or vignette) and a tone together.
 */

export type ArchiveStateKind = "loading" | "empty" | "error" | "notFound";

const tone: Record<ArchiveStateKind, string> = {
  loading: "text-ink-3",
  empty: "text-ink-3",
  error: "text-brick-ink",
  notFound: "text-indigo",
};

const cardLabel: Record<ArchiveStateKind, string> = {
  loading: "Retrieving",
  empty: "Empty drawer",
  error: "Damaged record",
  notFound: "Not on file",
};

function Glyph({ kind }: { kind: ArchiveStateKind }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9", kind === "loading" && "pw-breathe")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
    >
      {kind === "loading" ? (
        <>
          <circle cx="20" cy="20" r="6" />
          <circle cx="20" cy="20" r="11" opacity="0.6" />
          <circle cx="20" cy="20" r="16" opacity="0.3" />
        </>
      ) : kind === "empty" ? (
        <>
          <rect x="7" y="9" width="26" height="22" rx="1" />
          <path d="M7 16h26" strokeDasharray="2 2" />
        </>
      ) : kind === "error" ? (
        <>
          <path d="M8 31 20 8l12 23Z" strokeLinejoin="round" />
          <path d="M20 17v7m0 3.5v.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="18" cy="18" r="9" />
          <path d="m25 25 8 8M14.5 18h7" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

interface ArchiveStateProps {
  kind: ArchiveStateKind;
  title: string;
  hint?: string;
  /** Archive code stamped on the card head, e.g. "404" or "ERR 503". */
  code?: string;
  action?: React.ReactNode;
  className?: string;
  /** Heading level for the title; default h2. */
  as?: "h1" | "h2" | "h3";
  /** A vignette (server-rendered) drawn in the card's corner when available. */
  art?: React.ReactNode;
}

export function ArchiveState({
  kind,
  title,
  hint,
  code,
  action,
  className,
  as: Heading = "h2",
  art,
}: ArchiveStateProps) {
  return (
    <div
      role={kind === "error" ? "alert" : kind === "loading" ? "status" : undefined}
      aria-busy={kind === "loading" || undefined}
      className={cn("pw-card relative flex flex-col overflow-hidden px-6 pb-12 sm:px-8", className)}
    >
      <p aria-hidden="true" className="pw-label flex h-11 items-center justify-between">
        <span>{cardLabel[kind]}</span>
        {code ? <span className="pw-stamp">{code}</span> : null}
      </p>
      {art ? (
        <span
          className={cn(
            "pointer-events-none absolute right-5 bottom-6 w-28 sm:w-36",
            kind === "loading" && "pw-breathe",
          )}
        >
          {art}
        </span>
      ) : null}
      <div className="relative mt-5 flex flex-col items-start gap-3 sm:pr-32">
        <span className={tone[kind]}>
          <Glyph kind={kind} />
        </span>
        <Heading className="font-display text-h4 leading-[1.75rem] text-ink">{title}</Heading>
        {hint ? <p className="max-w-prose text-small leading-[1.75rem] text-ink-2">{hint}</p> : null}
        {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
