import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";

export const metadata: Metadata = { title: "New entry 新建条目" };

const TEMPLATE = `:::zh
用一两句话说明它是什么。
:::

:::en
Say what it is in a sentence or two.
:::

## 结构 | Structure
`;

export default async function NewEntryPage() {
  const { t } = await getT();
  const { entries, references } = getServices();
  const [sources, tags, authors, allEntries, assets] = await Promise.all([
    references.listSources(),
    references.listTags(),
    references.listAuthors(),
    entries.listEntries({ status: ["published"] }),
    references.listAssets(),
  ]);
  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead left={`${t("site.name")} · ${t("editor.headingNew")}`} right="PW-····" />
      <h1 className="sr-only">{t("editor.headingNew")}</h1>
      <MarkdownEditor
        initial={{
          title: { zh: "", en: "" },
          summary: { zh: "", en: "" },
          body: TEMPLATE,
          state: "draft",
          domain: "algorithms",
        }}
        options={{ sources, tags, authors, entries: allEntries, assets }}
      />
    </div>
  );
}
