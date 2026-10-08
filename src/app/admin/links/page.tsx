import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { ArchiveView } from "@/lib/services/contracts";
import { chartingOrder } from "@/lib/links/chart";
import {
  DeskHead,
  EmptyDrawer,
  formatWhen,
  Ledger,
  LedgerRow,
  ReadFailure,
  StateTag,
  tr,
} from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { LinkForm, LinkRowActions } from "@/components/admin/CommunityActions";

export const metadata: Metadata = { title: "友链 Links" };

/** The gazetteer of friend sites. Saving is public at once and redraws the chart in joining order. */
export default async function AdminLinks({ searchParams }: PageProps<"/admin/links">) {
  const lang = await getLang();
  const params = await searchParams;
  const view = (["archived", "all"].includes(String(params.view)) ? params.view : "active") as ArchiveView;
  const links = await getServices()
    .community.listLinks({ view })
    .catch(() => null);
  const ordered = links ? chartingOrder(links) : [];
  return (
    <>
      <DeskHead
        kicker="Gazetteer"
        title={tr(lang, "友链", "Friend links")}
        lede={tr(
          lang,
          "友链按加入日期在地图上依次占据领地。新增、修改或归档会立即反映在公开目录与地图中；同一个地址只能登记一次。",
          "Links claim territories on the chart in joining order. Adding, editing or archiving shows at once in the public directory and chart; an address is listed only once.",
        )}
        actions={<LinkForm />}
      />
      <DeskFilters
        filters={[
          {
            name: "view",
            label: tr(lang, "范围", "Showing"),
            value: view === "active" ? "" : view,
            options: [
              ["", tr(lang, "公开中", "Public")],
              ["archived", tr(lang, "已归档", "Archived")],
              ["all", tr(lang, "全部", "Everything")],
            ],
          },
        ]}
      />
      {!links ? (
        <ReadFailure lang={lang} />
      ) : ordered.length === 0 ? (
        <EmptyDrawer title={tr(lang, "目录里还没有友链。", "The gazetteer is empty.")}>
          {tr(lang, "用“新增友链”登记第一个友站。", "Use “New link” to list the first friend site.")}
        </EmptyDrawer>
      ) : (
        <Ledger label={tr(lang, "友链目录", "Link directory")}>
          {ordered.map((link, index) => (
            <LedgerRow
              key={link.id}
              muted={Boolean(link.archivedAt)}
              className="md:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(12rem,1fr)] md:items-start"
            >
              <span className="font-letterpress text-h4 text-ink-3">{link.archivedAt ? "—" : index + 1}</span>
              <div className="min-w-0">
                <p className="font-display text-h4 break-words text-ink">{link.name[lang]}</p>
                <a
                  href={link.url}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="pw-link font-mono text-meta break-all text-ink-2"
                >
                  {link.url}
                </a>
                <p className="mt-1 text-small break-words text-ink-2">{link.description[lang]}</p>
              </div>
              <div className="flex flex-wrap items-start gap-1.5 text-small text-ink-2">
                {link.archivedAt ? (
                  <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag>
                ) : (
                  <StateTag tone="ok">{tr(lang, "公开", "Public")}</StateTag>
                )}
                {link.sample ? <StateTag tone="warn">{tr(lang, "示例", "Sample")}</StateTag> : null}
                <span className="w-full text-meta text-ink-3">
                  {tr(lang, "加入", "Joined")} {formatWhen(link.since, lang).split(" ").slice(0, 3).join(" ")}
                </span>
              </div>
              <LinkRowActions link={link} />
            </LedgerRow>
          ))}
        </Ledger>
      )}
    </>
  );
}
