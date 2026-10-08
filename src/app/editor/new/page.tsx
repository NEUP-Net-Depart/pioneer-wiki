import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { AccessGate, gateReason } from "@/components/states/AccessGate";

export const metadata: Metadata = { title: "New entry 新建条目", robots: { index: false } };

const TEMPLATE = `:::zh
用一两句话说明它是什么，再说明它解决什么问题。
:::

:::en
Say what it is in a sentence or two, then what problem it solves.
:::

## 结构 | Structure

:::zh
:::

:::en
:::
`;

/** ?genus=<slug> files the new entry there from the start (linked from an empty genus page). */
export default async function NewEntryPage({ searchParams }: PageProps<"/editor/new">) {
  const { genus } = await searchParams;
  const { t, lang } = await getT();
  const { entries, references, taxonomy, auth } = getServices();
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "author");
  if (refused) return <AccessGate reason={refused} lang={lang} next="/editor/new" />;
  const [sources, tags, authors, allEntries, assets, families, categories, serverDraft] = await Promise.all([
    references.listSources(),
    references.listTags(),
    references.listAuthors(),
    entries.listEntries(),
    references.listAssets(),
    taxonomy.listFamilies(),
    taxonomy.listCategories(),
    entries.getWorkingDraft({}).catch(() => null),
  ]);
  const start = typeof genus === "string" ? categories.find((c) => c.slug === genus || c.id === genus) : undefined;
  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead left={`${t("site.name")} · ${t("editor.headingNew")}`} right="PW-····" />
      <header className="max-w-3xl">
        <p className="font-mono text-meta tracking-[0.14em] text-brick-ink uppercase">{lang === "zh" ? "新建条目" : "New entry"}</p>
        <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-tight">{t("editor.headingNew")}</h1>
        <p className="mt-3 max-w-prose text-small leading-relaxed text-ink-2">
          {lang === "zh"
            ? "按页面顺序填写：标题与摘要、编目位置、来源与关系，最后是正文。编辑时内容会自动保存到你的工作区；“保存草稿”会生成第一个修订，“提交审核”后由管理员审阅发布。在发布之前，读者看不到这篇条目。"
            : "Work down the page: titles and summaries, catalogue place, sources and relations, then the body. Your work autosaves to your workspace; Save draft makes the first revision, Submit sends it to an administrator to publish. Readers see nothing until it is published."}
        </p>
      </header>
      <MarkdownEditor
        accountId={account!.id}
        admin={account!.role === "admin"}
        initial={{
          title: { zh: "", en: "" },
          summary: { zh: "", en: "" },
          body: TEMPLATE,
          state: "draft",
          metadata: start ? { categoryId: start.id } : undefined,
        }}
        serverDraft={serverDraft}
        options={{ sources, tags, authors, entries: allEntries, assets, families, categories }}
      />
    </div>
  );
}
