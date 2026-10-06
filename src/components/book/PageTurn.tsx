import Link from "next/link";

interface Side {
  href: string;
  /** Small line, e.g. "门 II" or "PW-0002". */
  kicker: string;
  title: string;
}

/** Previous / next page at the foot of a book page. */
export function PageTurn({
  prev,
  next,
  label,
}: {
  prev?: Side | null;
  next?: Side | null;
  label: { prev: string; next: string; nav: string };
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label={label.nav} className="pw-ink-over mt-(--space-section) grid grid-cols-2 gap-6 pt-6">
      <div>
        {prev ? (
          <Link href={prev.href} className="group block no-underline">
            <span className="pw-smallcaps block text-small text-ink-3">
              ← {label.prev} · {prev.kicker}
            </span>
            <span className="mt-1 block font-display text-h4 text-ink group-hover:text-indigo">{prev.title}</span>
          </Link>
        ) : null}
      </div>
      <div className="text-right">
        {next ? (
          <Link href={next.href} className="group block no-underline">
            <span className="pw-smallcaps block text-small text-ink-3">
              {next.kicker} · {label.next} →
            </span>
            <span className="mt-1 block font-display text-h4 text-ink group-hover:text-indigo">{next.title}</span>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
