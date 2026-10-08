import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import type { AccountQuery } from "@/lib/services/contracts";
import type { AccountStatus } from "@/lib/model/types";
import { CellLabel, DeskHead, EmptyDrawer, formatWhen, Ledger, LedgerRow, Pager, ReadFailure, StateTag, tr } from "@/components/admin/desk";
import { DeskFilters } from "@/components/admin/DeskFilters";
import { AccountActions } from "@/components/admin/AccountActions";

export const metadata: Metadata = { title: "账号 Accounts" };

const LIMIT = 25;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
const FLAGS = ["closure", "unverified", "bound", "unbound", "applicant"] as const;

/** Every account: who it is, what it may do, what it is bound to, and the changes an administrator can make. */
export default async function AdminAccounts({ searchParams }: PageProps<"/admin/accounts">) {
  const lang = await getLang();
  const params = await searchParams;
  const q = one(params.q);
  const status = one(params.status);
  const role = one(params.role);
  const flag = (FLAGS as readonly string[]).includes(one(params.flag)) ? (one(params.flag) as AccountQuery["flag"]) : undefined;
  const offset = Math.max(0, Number(one(params.offset)) || 0);
  const { accounts, auth, references, community } = getServices();
  const [me, page, authors, members, everyone] = await Promise.all([
    auth.getCurrentAccount(),
    accounts
      .listAccounts({
        text: q,
        status: status ? [status as AccountStatus] : [],
        role: role === "admin" || role === "reader" ? [role] : [],
        flag,
        limit: LIMIT,
        offset,
      })
      .catch(() => null),
    references.listAuthors(),
    community.listMembers({ view: "all" }),
    accounts.listAccounts({ flag: "bound", limit: 100 }).catch(() => null),
  ]);
  const takenAuthors = new Set(everyone?.rows.map((a) => a.authorId).filter(Boolean));
  const takenMembers = new Set(everyone?.rows.map((a) => a.memberId).filter(Boolean));
  const authorOptions = authors.map((a) => ({ id: a.id, label: `${a.name[lang]} · ${a.handle}`, taken: takenAuthors.has(a.id) }));
  const memberOptions = members.map((m) => ({
    id: m.id,
    label: `${m.name[lang]} · /members/${m.handle}${m.archivedAt ? (lang === "zh" ? "（已归档）" : " (archived)") : ""}`,
    taken: takenMembers.has(m.id),
  }));
  return (
    <>
      <DeskHead
        kicker="Register of accounts"
        title={tr(lang, "账号", "Accounts")}
        lede={tr(
          lang,
          "注册并验证邮箱的人是读者。作者资格与成员主页由管理员批准或绑定；停用会立即撤销登录，注销会清除个人信息但保留历史署名与审计。",
          "Anyone who registers and verifies is a reader. Author status and member pages are granted or bound by administrators; suspension ends sign-ins at once, closure removes personal data but keeps historical credit and the audit trail.",
        )}
      />
      <DeskFilters
        text={{ value: q, placeholder: tr(lang, "邮箱、显示名、作者或主页", "Email, name, author or page") }}
        filters={[
          {
            name: "status",
            label: tr(lang, "状态", "Status"),
            value: status,
            options: [
              ["", tr(lang, "全部", "All")],
              ["active", tr(lang, "正常", "Active")],
              ["suspended", tr(lang, "已停用", "Suspended")],
              ["closed", tr(lang, "已注销", "Closed")],
            ],
          },
          {
            name: "role",
            label: tr(lang, "角色", "Role"),
            value: role,
            options: [
              ["", tr(lang, "全部", "All")],
              ["admin", tr(lang, "管理员", "Administrator")],
              ["reader", tr(lang, "读者", "Reader")],
            ],
          },
          {
            name: "flag",
            label: tr(lang, "需要关注", "Needs attention"),
            value: flag ?? "",
            options: [
              ["", tr(lang, "不限", "Any")],
              ["closure", tr(lang, "申请注销", "Closure requested")],
              ["applicant", tr(lang, "有待审申请", "Pending application")],
              ["unverified", tr(lang, "未验证邮箱", "Unverified")],
              ["bound", tr(lang, "已绑定身份", "Bound")],
              ["unbound", tr(lang, "未绑定身份", "Unbound")],
            ],
          },
        ]}
      />
      {!page ? (
        <ReadFailure lang={lang} />
      ) : page.rows.length === 0 ? (
        <EmptyDrawer title={tr(lang, "没有符合条件的账号。", "No accounts match.")} />
      ) : (
        <>
          <Ledger label={tr(lang, "账号登记簿", "Account register")}>
            {page.rows.map((account) => (
              <LedgerRow
                key={account.id}
                muted={account.status !== "active"}
                className="md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(12rem,1.4fr)] md:items-start"
              >
                <div className="min-w-0">
                  <p className="font-display text-h4 break-words text-ink">{account.name[lang] || account.handle}</p>
                  <p className="font-mono text-meta break-all text-ink-3">{account.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {account.role === "admin" ? <StateTag tone="pending">{tr(lang, "管理员", "Admin")}</StateTag> : <StateTag>{tr(lang, "读者", "Reader")}</StateTag>}
                    {account.status === "suspended" ? <StateTag tone="danger">{tr(lang, "已停用", "Suspended")}</StateTag> : null}
                    {account.status === "closed" ? <StateTag tone="quiet">{tr(lang, "已注销", "Closed")}</StateTag> : null}
                    {!account.emailVerified ? <StateTag tone="warn">{tr(lang, "邮箱未验证", "Unverified")}</StateTag> : null}
                    {account.closureRequestedAt && account.status !== "closed" ? <StateTag tone="danger">{tr(lang, "申请注销", "Closure requested")}</StateTag> : null}
                    {account.pendingApplicationId ? (
                      <Link href="/admin/applications" className="no-underline">
                        <StateTag tone="warn">{tr(lang, "待审申请", "Applied")}</StateTag>
                      </Link>
                    ) : null}
                  </div>
                  {account.statusReason ? <p className="mt-1 text-meta text-ink-3">{account.statusReason}</p> : null}
                </div>
                <div className="text-small text-ink-2">
                  <p>
                    <CellLabel>{tr(lang, "作者", "Author")}</CellLabel>
                    {account.authorName ? account.authorName[lang] : <span className="text-ink-3">{tr(lang, "未绑定作者", "No author")}</span>}
                  </p>
                  <p className="mt-1">
                    <CellLabel>{tr(lang, "主页", "Page")}</CellLabel>
                    {account.memberHandle ? (
                      <Link href={`/members/${account.memberHandle}`} className="pw-link">
                        /members/{account.memberHandle}
                      </Link>
                    ) : (
                      <span className="text-ink-3">{tr(lang, "未绑定主页", "No page")}</span>
                    )}
                    {account.memberArchived ? <span className="ml-1 text-meta text-ink-3">{tr(lang, "（已归档）", "(archived)")}</span> : null}
                  </p>
                  <p className="mt-1 text-meta text-ink-3">
                    {tr(lang, "注册", "Joined")} {formatWhen(account.createdAt, lang)} · {tr(lang, "最近登录", "Last sign-in")}{" "}
                    {formatWhen(account.lastSignInAt, lang)}
                  </p>
                </div>
                <AccountActions account={account} self={account.id === me?.id} authors={authorOptions} members={memberOptions} />
              </LedgerRow>
            ))}
          </Ledger>
          <Pager lang={lang} path="/admin/accounts" params={{ q, status, role, flag }} offset={offset} limit={LIMIT} total={page.total} />
        </>
      )}
    </>
  );
}
