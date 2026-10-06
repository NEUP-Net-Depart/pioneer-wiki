"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { ArchiveState } from "@/components/states/ArchiveState";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mt-(--space-section) max-w-xl">
      <ArchiveState
        kind="error"
        as="h1"
        code={error.digest ? `ERR ${error.digest.slice(0, 8)}` : "ERR"}
        title={t("state.error")}
        hint={t("state.errorHint")}
        action={
          <>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center rounded-sm bg-ink px-4 text-small text-paper-sheet hover:bg-ink-2"
            >
              {t("state.retry")}
            </button>
            <Link
              href="/"
              className="inline-flex h-9 items-center rounded-sm border border-rule-strong px-4 text-small text-ink no-underline hover:bg-ink/5"
            >
              {t("state.backHome")}
            </Link>
          </>
        }
      />
    </div>
  );
}
