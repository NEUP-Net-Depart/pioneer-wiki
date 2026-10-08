import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getT } from "@/lib/i18n/server";
import { TaxonomyDesk } from "@/components/admin/TaxonomyDesk";
import { DeskHead } from "@/components/admin/desk";

export const metadata: Metadata = { title: "分类 Catalogue" };

/**
 * 分类管理 — the curators' register of families and genera. Saving is public
 * at once, every change is kept as a version, and a taxon can be archived and
 * restored but never deleted. The office layout admits administrators only.
 */
export default async function TaxonomyAdminPage() {
  const { taxonomy, references, entries } = getServices();
  const { lang } = await getT();
  const zh = lang === "zh";
  const [families, categories, authors] = await Promise.all([
    taxonomy.listFamilies({ includeArchived: true }),
    taxonomy.listCategories({ includeArchived: true }),
    references.listAuthors(),
  ]);
  // Genus → how many entries are filed under it (any state), so archiving warns before hiding live work.
  const filed: Record<string, number> = {};
  for (let offset = 0; ; offset += 100) {
    const page = await entries.listEditorial({ scope: "all", view: "all", limit: 100, offset });
    for (const e of page.rows) if (e.categoryId) filed[e.categoryId] = (filed[e.categoryId] ?? 0) + 1;
    if (offset + 100 >= page.total) break;
  }

  return (
    <>
      <DeskHead
        kicker="Curators’ register"
        title={zh ? "分类管理" : "The catalogue"}
        lede={
          zh
            ? `科与属在这里编目（${families.length} 科 · ${categories.length} 属）。保存后立即公开，每次修改都留下一版，可随时回到旧版；分类只能归档与恢复，不能删除。负责人与协作者用于署名，不改变编辑权限。`
            : `Families and genera are catalogued here (${families.length} families · ${categories.length} genera). Saving is public at once; every change is kept as a version you can return to. Taxa can be archived and restored, never deleted. Leads and collaborators are credited; they do not change who may edit.`
        }
      />
      <TaxonomyDesk
        lang={lang}
        families={families}
        categories={categories}
        authors={authors.map((a) => ({ id: a.id, name: a.name }))}
        filed={filed}
      />
    </>
  );
}
