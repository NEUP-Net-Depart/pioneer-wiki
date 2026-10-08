import type { Metadata } from "next";
import Link from "next/link";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { formatWhen, StateTag } from "@/components/admin/desk";
import { ApplicationForm, SectionCard, WithdrawApplication } from "@/components/account/AccountForms";

export const metadata: Metadata = { title: "身份与申请 Identity" };

/**
 * The account, the wiki author and the member page are three records. This
 * page says which ones this account has, and lets a reader ask for the rest.
 */
export default async function IdentityPage() {
  const lang = await getLang();
  const zh = lang === "zh";
  const { auth, accounts, community } = getServices();
  const account = (await auth.getCurrentAccount())!;
  const [author, member, applications] = await Promise.all([
    auth.getCurrentUser(),
    account.memberId ? community.getMember(account.memberId, { includeArchived: true }).catch(() => null) : null,
    accounts.listOwnApplications().catch(() => []),
  ]);
  const pending = applications.find((a) => a.status === "pending");
  const needsAuthor = !account.authorId;
  const needsMember = !account.memberId;
  const active = (account.status ?? "active") === "active" && account.emailVerified;
  return (
    <>
      <SectionCard title={zh ? "站内身份" : "Identity on the site"}>
        <dl className="grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="pw-label">{zh ? "Wiki 作者" : "Wiki author"}</dt>
            <dd className="mt-2 text-small leading-relaxed text-ink-2">
              {author ? (
                <>
                  <span className="font-display text-h4 text-ink">{author.name[lang]}</span>
                  <br />
                  {zh
                    ? "可以新建条目、修改自己的条目并提交审核。"
                    : "You can create entries, edit your own and submit them for review."}{" "}
                  <Link href="/account/entries" className="pw-link text-ink">
                    {zh ? "我的文章" : "My entries"} →
                  </Link>
                </>
              ) : zh ? (
                "尚未获得作者资格。作者资格由管理员批准。"
              ) : (
                "No author status yet; administrators grant it."
              )}
            </dd>
          </div>
          <div>
            <dt className="pw-label">{zh ? "成员主页" : "Member page"}</dt>
            <dd className="mt-2 text-small leading-relaxed text-ink-2">
              {member ? (
                <>
                  <Link href={`/members/${member.handle}`} className="pw-link font-display text-h4 text-ink">
                    {member.name[lang]}
                  </Link>
                  {member.archivedAt ? (
                    <span className="ml-2">
                      <StateTag tone="quiet">{zh ? "已归档" : "Archived"}</StateTag>
                    </span>
                  ) : null}
                  <br />
                  {member.archivedAt
                    ? zh
                      ? "主页已被管理员归档，读者看不到它，暂时不能编辑。"
                      : "Archived by an administrator: readers cannot see it, and it cannot be edited for now."
                    : zh
                      ? "保存后立即公开。"
                      : "Saved changes are public at once."}{" "}
                  {!member.archivedAt ? (
                    <Link href={`/members/${member.handle}/edit`} className="pw-link text-ink">
                      {zh ? "编辑我的主页" : "Edit my page"} →
                    </Link>
                  ) : null}
                </>
              ) : zh ? (
                "尚未绑定公开主页。主页由管理员建立或绑定，注册不会自动生成。"
              ) : (
                "No page bound. Administrators create or bind pages; registering does not make one."
              )}
            </dd>
          </div>
        </dl>
      </SectionCard>
      {needsAuthor || needsMember ? (
        <SectionCard title={zh ? "申请资格" : "Apply"}>
          {pending ? (
            <div className="flex flex-col gap-2 text-small text-ink-2">
              <p>
                <StateTag tone="warn">{zh ? "等待处理" : "Waiting"}</StateTag> {zh ? "你在 " : "You applied on "}
                {formatWhen(pending.createdAt, lang)}
                {zh ? " 提交的申请正在等待管理员处理。" : "; an administrator will decide."}
              </p>
              <blockquote className="border-l-2 border-rule-strong pl-3 whitespace-pre-wrap">
                {pending.statement}
              </blockquote>
              <WithdrawApplication application={pending} />
            </div>
          ) : active ? (
            <ApplicationForm needsAuthor={needsAuthor} needsMember={needsMember} />
          ) : (
            <p className="text-small text-ink-2">
              {zh ? "验证邮箱且账号正常后才能提交申请。" : "Applying needs a verified, active account."}
            </p>
          )}
        </SectionCard>
      ) : null}
      {applications.some((a) => a.status !== "pending") ? (
        <SectionCard title={zh ? "申请记录" : "Earlier applications"}>
          <ul className="flex flex-col divide-y divide-rule">
            {applications
              .filter((a) => a.status !== "pending")
              .map((application) => (
                <li key={application.id} className="flex flex-col gap-1 py-3 text-small">
                  <span className="flex flex-wrap items-center gap-2">
                    <StateTag
                      tone={
                        application.status === "approved"
                          ? "ok"
                          : application.status === "rejected"
                            ? "danger"
                            : "quiet"
                      }
                    >
                      {application.status === "approved"
                        ? zh
                          ? "已批准"
                          : "Approved"
                        : application.status === "rejected"
                          ? zh
                            ? "未通过"
                            : "Not approved"
                          : zh
                            ? "已撤回"
                            : "Withdrawn"}
                    </StateTag>
                    <span className="font-mono text-meta text-ink-3">
                      {formatWhen(application.decidedAt ?? application.createdAt, lang)}
                    </span>
                  </span>
                  {application.decisionReason ? (
                    <span className="text-ink-2">
                      {zh ? "管理员说明：" : "Note: "}
                      {application.decisionReason}
                    </span>
                  ) : null}
                </li>
              ))}
          </ul>
        </SectionCard>
      ) : null}
    </>
  );
}
