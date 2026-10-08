import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { ArchiveView } from "@/lib/services/contracts";
import { CHRONICLE_KINDS } from "@/lib/model/vocab";
import { DeskHead, EmptyDrawer, Ledger, LedgerRow, Pager, ReadFailure, StateTag, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { ChronicleForm, ChronicleRowActions } from "@/components/admin/CommunityActions";

export const metadata: Metadata = { title: "纪行 Chronicles" };

const LIMIT = 25;

/** The annals: add, edit, archive and restore dated records; recordings and files stay at their own address. */
export default async function AdminChronicles({ searchParams }: PageProps<"/admin/chronicles">) {
  const lang = await getLang();
  const params = await searchParams;
  const view = (["archived", "all"].includes(String(params.view)) ? params.view : "active") as ArchiveView;
  const q = typeof params.q === "string" ? params.q : "";
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const { chronicles, community } = getServices();
  const [page, members] = await Promise.all([
    chronicles.listForAdmin({ view, q, limit: LIMIT, offset }).catch(() => null),
    community.listMembers({ view: "all" }),
  ]);
  const memberOptions = members.map((m) => ({ id: m.id, label: m.name[lang] }));
  return (
    <>
      <DeskHead
        kicker="The annals"
        title={tr(lang, "纪行", "Chronicles")}
        lede={tr(
          lang,
          "纪行保存后立即公开。录像与文件不在本站存放，只登记标签与外部地址；归档的记录会从编年册和成员页中隐藏。",
          "Records are public when saved. Recordings and files are not stored here — only their labels and external addresses; archived records leave the annals and member pages.",
        )}
        actions={<ChronicleForm members={memberOptions} />}
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "标题、摘要或记述", "Title, summary or account") }}
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
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的纪行。", "No records match.")} />
      ) : (
        <>
          <Ledger label={tr(lang, "编年册", "Annals")}>
            {page.rows.map((record) => (
              <LedgerRow
                key={record.id}
                muted={Boolean(record.archivedAt)}
                className="md:grid-cols-[7rem_minmax(0,1fr)_minmax(12rem,auto)] md:items-start"
              >
                <div className="font-mono text-meta text-ink-3">
                  <p>No. {String(record.number).padStart(3, "0")}</p>
                  <p>{record.date.slice(0, 10)}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-display text-h4 break-words text-ink">{record.title[lang]}</p>
                  <p className="mt-1 text-small break-words text-ink-2">{record.summary[lang]}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <StateTag>{CHRONICLE_KINDS[record.kind].label[lang]}</StateTag>
                    {record.archivedAt ? <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag> : null}
                    {record.sample ? <StateTag tone="warn">{tr(lang, "示例", "Sample")}</StateTag> : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {!record.archivedAt ? (
                    <Link href={`/chronicles/${record.id}`} className="pw-link min-h-8 text-small text-ink-2">
                      {tr(lang, "公开页", "Public page")}
                    </Link>
                  ) : null}
                  <ChronicleRowActions record={record} members={memberOptions} />
                </div>
              </LedgerRow>
            ))}
          </Ledger>
          <Pager
            lang={lang}
            path="/admin/chronicles"
            params={{ q, view: view === "active" ? undefined : view }}
            offset={offset}
            limit={LIMIT}
            total={page.total}
          />
        </>
      )}
    </>
  );
}
