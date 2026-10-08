import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { ApplicationStatus } from "@/lib/model/types";
import {
  DeskHead,
  EmptyDrawer,
  formatWhen,
  Ledger,
  LedgerRow,
  Pager,
  ReadFailure,
  StateTag,
  tr,
} from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { ApplicationDecision } from "@/components/admin/ApplicationDecision";

export const metadata: Metadata = { title: "资格申请 Applications" };

const LIMIT = 20;
const STATUSES: ApplicationStatus[] = ["pending", "approved", "rejected", "withdrawn"];

/** Readers asking to write for the wiki or to have a member page. */
export default async function AdminApplications({ searchParams }: PageProps<"/admin/applications">) {
  const lang = await getLang();
  const params = await searchParams;
  const status = STATUSES.includes(params.status as ApplicationStatus)
    ? (params.status as ApplicationStatus)
    : "pending";
  const offset = Math.max(0, Number(typeof params.offset === "string" ? params.offset : 0) || 0);
  const { accounts, references, community } = getServices();
  const [page, authors, members] = await Promise.all([
    accounts.listApplications({ status: [status], limit: LIMIT, offset }).catch(() => null),
    references.listAuthors(),
    community.listMembers({ view: "all" }),
  ]);
  const kindLabel = (kind: string) =>
    kind === "both"
      ? tr(lang, "作者与成员主页", "Author and page")
      : kind === "author"
        ? tr(lang, "作者资格", "Author status")
        : tr(lang, "成员主页", "Member page");
  return (
    <>
      <DeskHead
        kicker="Applications"
        title={tr(lang, "资格申请", "Applications")}
        lede={tr(
          lang,
          "注册不会自动获得作者资格或公开主页。在这里批准时可以选择已有的作者与主页，或直接新建；拒绝需要写明原因。",
          "Registering grants neither author status nor a public page. Approve here by choosing an existing author and page or creating them; rejecting needs a reason.",
        )}
      />
      <DeskFilters
        filters={[
          {
            name: "status",
            label: tr(lang, "状态", "Status"),
            value: status === "pending" ? "" : status,
            options: [
              ["", tr(lang, "待处理", "Pending")],
              ["approved", tr(lang, "已批准", "Approved")],
              ["rejected", tr(lang, "已拒绝", "Rejected")],
              ["withdrawn", tr(lang, "已撤回", "Withdrawn")],
            ],
          },
        ]}
      />
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer
          title={
            status === "pending"
              ? tr(lang, "没有待处理的申请。", "No applications are waiting.")
              : tr(lang, "没有符合条件的申请。", "No applications match.")
          }
        />
      ) : (
        <>
          <Ledger label={tr(lang, "申请登记簿", "Applications")}>
            {page.rows.map((application) => (
              <LedgerRow
                key={application.id}
                className="md:grid-cols-[minmax(0,1fr)_minmax(14rem,auto)] md:items-start"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StateTag
                      tone={
                        application.status === "pending" ? "warn" : application.status === "approved" ? "ok" : "quiet"
                      }
                    >
                      {kindLabel(application.kind)}
                    </StateTag>
                    <span className="font-mono text-meta text-ink-3">{formatWhen(application.createdAt, lang)}</span>
                  </div>
                  <p className="mt-2 font-display text-h4 text-ink">
                    {application.account ? application.account.name[lang] : tr(lang, "已注销的账号", "Closed account")}
                  </p>
                  {application.account ? (
                    <p className="font-mono text-meta break-all text-ink-3">{application.account.email}</p>
                  ) : null}
                  <blockquote className="mt-3 border-l-2 border-rule-strong pl-3 text-small whitespace-pre-wrap text-ink-2">
                    {application.statement}
                  </blockquote>
                  {application.proposedHandle ? (
                    <p className="mt-2 text-meta text-ink-3">
                      {tr(lang, "希望的代号：", "Proposed handle: ")}
                      <span className="font-mono">{application.proposedHandle}</span>
                    </p>
                  ) : null}
                  {application.decisionReason ? (
                    <p className="mt-2 text-small text-ink-2">
                      {tr(lang, "处理说明：", "Decision note: ")}
                      {application.decisionReason}
                    </p>
                  ) : null}
                </div>
                {application.status === "pending" && application.account ? (
                  <ApplicationDecision
                    application={application}
                    authors={authors.map((a) => ({ id: a.id, label: `${a.name[lang]} · ${a.handle}` }))}
                    members={members.map((m) => ({ id: m.id, label: `${m.name[lang]} · /members/${m.handle}` }))}
                  />
                ) : null}
              </LedgerRow>
            ))}
          </Ledger>
          <Pager
            lang={lang}
            path="/admin/applications"
            params={{ status: status === "pending" ? undefined : status }}
            offset={offset}
            limit={LIMIT}
            total={page.total}
          />
        </>
      )}
    </>
  );
}
