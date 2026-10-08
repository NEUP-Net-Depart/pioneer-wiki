"use client";

import { useState } from "react";
import type { AccountRecord, Localized } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";

type Option = { id: string; label: string; taken?: boolean };

/**
 * The administrative changes to one account. Each names the account and its
 * consequence; none of them touches another account, and the database keeps
 * the last administrator in place whatever is clicked here.
 */
export function AccountActions({
  account,
  self,
  authors,
  members,
}: {
  account: AccountRecord;
  self: boolean;
  authors: Option[];
  members: Option[];
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const [authorId, setAuthorId] = useState(account.authorId ?? "");
  const [memberId, setMemberId] = useState(account.memberId ?? "");
  const who = `${account.name[lang] || account.handle} <${account.email}>`;
  const post = (body: unknown) => api(`/api/admin/accounts/${account.id}`, "POST", body);
  if (account.status === "closed")
    return <p className="text-small text-ink-3">{zh ? "已注销，无可执行的操作。" : "Closed; nothing to do."}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {account.role === "admin" ? (
          <ConfirmAction
            tone="danger"
            disabled={self}
            trigger={zh ? "撤销管理员" : "Revoke admin"}
            title={zh ? "撤销管理员权限？" : "Revoke administrator access?"}
            description={
              zh
                ? `${who} 将不再能进入编辑室、发布文章或管理账号。作者身份与已发布内容不受影响。系统不允许移除最后一位管理员。`
                : `${who} will no longer enter the office, publish or manage accounts. Their author record and published work stay. The last administrator can never be removed.`
            }
            reason={{ label: zh ? "原因（记入审计）" : "Reason (audit log)" }}
            confirmLabel={zh ? "撤销管理员权限" : "Revoke access"}
            onConfirm={async (reason) => {
              await post({ action: "set_role", role: "reader", reason });
              succeed(zh ? "已撤销管理员权限。" : "Administrator access revoked.");
            }}
          />
        ) : (
          <ConfirmAction
            disabled={account.status !== "active" || !account.emailVerified}
            trigger={zh ? "授予管理员" : "Make admin"}
            title={zh ? "授予管理员权限？" : "Grant administrator access?"}
            description={
              zh
                ? `${who} 将可以审核与发布全部文章、管理账号、成员、友链、纪行和论坛。没有作者身份的账号会自动获得一个作者记录。`
                : `${who} will be able to review and publish every entry and manage accounts, members, links, chronicles and the forum. An account without an author record gets one.`
            }
            reason={{ label: zh ? "原因（记入审计）" : "Reason (audit log)" }}
            confirmLabel={zh ? "授予管理员权限" : "Grant access"}
            onConfirm={async (reason) => {
              await post({ action: "set_role", role: "admin", reason });
              succeed(zh ? "已授予管理员权限。" : "Administrator access granted.");
            }}
          />
        )}
        {account.status === "suspended" ? (
          <ConfirmAction
            trigger={zh ? "恢复账号" : "Reactivate"}
            title={zh ? "恢复这个账号？" : "Reactivate this account?"}
            description={zh ? `${who} 将可以重新登录并写作、交流。` : `${who} can sign in, write and post again.`}
            confirmLabel={zh ? "恢复账号" : "Reactivate account"}
            onConfirm={async () => {
              await post({ action: "set_status", status: "active" });
              succeed(zh ? "账号已恢复。" : "Account reactivated.");
            }}
          />
        ) : (
          <ConfirmAction
            tone="danger"
            disabled={self}
            trigger={zh ? "停用账号" : "Suspend"}
            title={zh ? "停用这个账号？" : "Suspend this account?"}
            description={
              zh
                ? `${who} 的所有登录会话会立即失效，之后不能登录，也不能写作、发帖或上传（包括直接调用数据库）。账号、作者身份与成员主页保留，可随时恢复。`
                : `Every session of ${who} ends now; they cannot sign in, write, post or upload (direct database calls included). The account, author record and page stay, and can be reactivated.`
            }
            reason={{ label: zh ? "停用原因（记入审计）" : "Reason (audit log)", required: true }}
            confirmLabel={zh ? "停用账号" : "Suspend account"}
            onConfirm={async (reason) => {
              await post({ action: "set_status", status: "suspended", reason });
              succeed(zh ? "账号已停用，会话已撤销。" : "Account suspended; its sessions are revoked.");
            }}
          />
        )}
        <ConfirmAction
          trigger={zh ? "身份绑定" : "Bindings"}
          title={zh ? "作者与成员主页绑定" : "Author and page bindings"}
          description={
            <div className="flex flex-col gap-4">
              <p>
                {zh
                  ? "账号、作者与成员主页是三个对象：作者决定能编辑哪些文章，成员主页是公开页面。解绑不会停用账号，也不会删除作者或主页。"
                  : "Account, author and member page are three records: the author decides which entries one may edit, the page is public. Unbinding neither suspends the account nor removes the author or page."}
              </p>
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "Wiki 作者" : "Wiki author"}</span>
                <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} className="pw-field text-small">
                  <option value="">{zh ? "（不绑定）" : "(none)"}</option>
                  {authors.map((option) => (
                    <option key={option.id} value={option.id} disabled={option.taken && option.id !== account.authorId}>
                      {option.label}
                      {option.taken && option.id !== account.authorId ? (zh ? "（已被占用）" : " (taken)") : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "成员主页" : "Member page"}</span>
                <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="pw-field text-small">
                  <option value="">{zh ? "（不绑定）" : "(none)"}</option>
                  {members.map((option) => (
                    <option key={option.id} value={option.id} disabled={option.taken && option.id !== account.memberId}>
                      {option.label}
                      {option.taken && option.id !== account.memberId ? (zh ? "（已被占用）" : " (taken)") : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
          reason={{ label: zh ? "原因（记入审计）" : "Reason (audit log)" }}
          confirmLabel={zh ? "保存绑定" : "Save bindings"}
          onConfirm={async (reason) => {
            await post({ action: "set_identity", authorId: authorId || null, memberId: memberId || null, reason });
            succeed(zh ? "绑定已更新。" : "Bindings saved.");
          }}
        />
        {account.closureRequestedAt ? (
          <ConfirmAction
            tone="danger"
            disabled={self}
            trigger={zh ? "处理注销" : "Process closure"}
            title={zh ? "注销这个账号？" : "Close this account?"}
            description={
              <ul className="list-disc space-y-1 pl-5">
                <li>{zh ? "删除登录邮箱、密码和登录身份，撤销所有会话；无法撤销。" : "Removes the sign-in email, password and identities and ends every session; this cannot be undone."}</li>
                <li>{zh ? "显示名、私人草稿与资格申请被清除；论坛署名改为“已注销账号”。" : "Clears display name, private drafts and applications; forum posts are signed “closed account”."}</li>
                <li>{zh ? "公开成员主页被归档；作者记录与已发布文章的历史署名保留。" : "Archives the public page; the author record and published history keep their credit."}</li>
                <li>{zh ? "审计记录保留账号编号。" : "Audit entries keep the account id."}</li>
              </ul>
            }
            reason={{ label: zh ? "处理说明（记入审计）" : "Note (audit log)" }}
            confirmLabel={zh ? "注销账号" : "Close account"}
            onConfirm={async (note) => {
              await post({ action: "close", note });
              succeed(zh ? "账号已注销。" : "Account closed.");
            }}
          />
        ) : null}
      </div>
      <NoticeLine notice={notice} className="text-meta" />
    </div>
  );
}

export const nameOf = (value: Localized | undefined, lang: "zh" | "en") => (value ? value[lang] || value.zh : "");
