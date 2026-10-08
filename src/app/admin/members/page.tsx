import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { ArchiveView } from "@/lib/services/contracts";
import { DeskHead, EmptyDrawer, Ledger, LedgerRow, ReadFailure, StateTag, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { MemberRowActions, NewMember } from "@/components/admin/CommunityActions";

export const metadata: Metadata = { title: "成员 Members" };

/** The roll of member pages, archived ones included on request; owners edit their own, administrators any. */
export default async function AdminMembers({ searchParams }: PageProps<"/admin/members">) {
  const lang = await getLang();
  const params = await searchParams;
  const view = (["archived", "all"].includes(String(params.view)) ? params.view : "active") as ArchiveView;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const { community, accounts } = getServices();
  const [members, bound] = await Promise.all([
    community.listMembers({ view }).catch(() => null),
    accounts.listAccounts({ flag: "bound", limit: 100 }).catch(() => null),
  ]);
  const owner = new Map(bound?.rows.filter((a) => a.memberId).map((a) => [a.memberId!, a]));
  const rows = (members ?? []).filter(
    (m) => !q || [m.handle, m.name.zh, m.name.en].some((value) => value.toLowerCase().includes(q)),
  );
  return (
    <>
      <DeskHead
        kicker="Roll of members"
        title={tr(lang, "成员", "Members")}
        lede={tr(
          lang,
          "成员主页由本人编辑，保存即公开；管理员可以代为编辑、建立和归档。主页与账号分开：归档主页不会停用账号，解绑账号也不会删除主页。",
          "Members edit their own pages, public on save; administrators can edit, create and archive them. Pages and accounts are separate: archiving a page suspends no account, unbinding an account deletes no page.",
        )}
        actions={<NewMember />}
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "姓名或地址", "Name or address") }}
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
      {!members ? (
        <ReadFailure lang={lang} />
      ) : rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的成员主页。", "No member pages match.")} />
      ) : (
        <Ledger label={tr(lang, "成员名册", "Member roll")}>
          {rows.map((member) => {
            const account = owner.get(member.id);
            return (
              <LedgerRow
                key={member.id}
                muted={Boolean(member.archivedAt)}
                className="md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(14rem,1.2fr)] md:items-start"
              >
                <div className="min-w-0">
                  <p className="font-mono text-meta text-ink-3">No. {String(member.plate.number).padStart(3, "0")}</p>
                  <p className="font-display text-h4 break-words text-ink">{member.name[lang]}</p>
                  <Link href={`/members/${member.handle}`} className="pw-link font-mono text-meta text-ink-2">
                    /members/{member.handle}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {member.archivedAt ? (
                      <StateTag tone="quiet">{tr(lang, "已归档", "Archived")}</StateTag>
                    ) : (
                      <StateTag tone="ok">{tr(lang, "公开", "Public")}</StateTag>
                    )}
                    {member.sample ? <StateTag tone="warn">{tr(lang, "示例", "Sample")}</StateTag> : null}
                  </div>
                </div>
                <div className="text-small text-ink-2">
                  <p className="pw-label md:sr-only">{tr(lang, "绑定账号", "Bound account")}</p>
                  {account ? (
                    <p className="break-all">{account.email}</p>
                  ) : (
                    <p className="text-ink-3">
                      {tr(lang, "未绑定账号 · ", "No account · ")}
                      <Link href="/admin/accounts?flag=unbound" className="pw-link">
                        {tr(lang, "去绑定", "Bind one")}
                      </Link>
                    </p>
                  )}
                </div>
                <MemberRowActions member={member} />
              </LedgerRow>
            );
          })}
        </Ledger>
      )}
    </>
  );
}
