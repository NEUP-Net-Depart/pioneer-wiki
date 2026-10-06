import type { Metadata } from "next";
import { REVIEW_STATE_IDS } from "@/lib/model/vocab";
import { getT } from "@/lib/i18n/server";
import { RunningHead } from "@/components/book/RunningHead";
import { Plate } from "@/components/book/Plate";
import { ArchiveState } from "@/components/states/ArchiveState";
import { StatusBadge } from "@/components/archive/StatusBadge";
import { SpecimenMark } from "@/components/archive/SpecimenMark";
import { KeyboardHint } from "@/components/archive/KeyboardHint";

export const metadata: Metadata = { title: "States 状态样例", robots: { index: false } };

/** Stable review entry for every non-content state and status treatment (for Codex's visual checks). */
export default async function StatesPage() {
  const { lang, t } = await getT();
  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead left="Dev · States" right="/dev/states" />
      <h1 className="font-display text-h1 font-[480] tracking-[-0.02em]">States</h1>

      <section className="grid gap-6 md:grid-cols-2">
        <ArchiveState kind="loading" title={t("state.loading")} />
        <ArchiveState kind="empty" title={t("state.empty")} hint={t("search.noResultsHint")} />
        <ArchiveState
          kind="error"
          code="ERR 503"
          title={t("state.error")}
          hint={t("state.errorHint")}
          action={<span className="text-small text-ink-3">[{t("state.retry")}]</span>}
        />
        <ArchiveState kind="notFound" code="404" title={t("entry.notFound")} hint={t("entry.notFoundHint")} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Review states</h2>
        <div className="flex flex-wrap gap-3">
          {REVIEW_STATE_IDS.map((s) => (
            <StatusBadge key={s} state={s} lang={lang} showForm />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-h3">Specimen marks</h2>
        <div className="flex flex-wrap items-end gap-8 text-ink-3">
          {REVIEW_STATE_IDS.map((s) => (
            <SpecimenMark
              key={`macro-${s}`}
              scale="macro"
              rings={4}
              state={s}
              crossover={s === "published"}
              className="size-16"
            />
          ))}
          {REVIEW_STATE_IDS.map((s) => (
            <SpecimenMark
              key={`micro-${s}`}
              scale="micro"
              rings={2}
              state={s}
              crossover={s === "draft"}
              className="size-12"
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <h2 className="font-display text-h3 md:col-span-3">Plate placeholder</h2>
        <Plate
          lang={lang}
          number="XII"
          fallback={{ scale: "macro", rings: 3, state: "published", crossover: true }}
          caption={{ zh: "插图待补的图版。", en: "A plate awaiting its illustration." }}
        />
      </section>

      <section className="flex flex-wrap items-center gap-3 text-small text-ink-2">
        <KeyboardHint keys={["/"]} /> {t("nav.search")} <KeyboardHint keys={["Esc"]} />{" "}
        <KeyboardHint keys={["Ctrl", "K"]} />
      </section>
    </div>
  );
}
