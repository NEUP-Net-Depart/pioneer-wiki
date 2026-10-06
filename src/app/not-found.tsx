import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { RunningHead } from "@/components/book/RunningHead";
import { ArchiveState } from "@/components/states/ArchiveState";
import { Vignette } from "@/components/book/Vignette";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="flex flex-col">
      <RunningHead left={`${t("site.name")} · 404`} />
      <div className="mt-(--space-section) max-w-xl">
        <ArchiveState
          kind="notFound"
          as="h1"
          code="404"
          title={t("entry.notFound")}
          hint={t("entry.notFoundHint")}
          art={<Vignette name="snail" />}
          action={
            <>
              <Link
                href="/search"
                className="inline-flex h-9 items-center rounded-sm bg-ink px-4 text-small text-paper-sheet no-underline hover:bg-ink-2"
              >
                {t("nav.search")}
              </Link>
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
    </div>
  );
}
