"use client";

import { useState } from "react";
import type { IdentityApplication } from "@/lib/model/types";
import type { IdentityChoice } from "@/lib/services/contracts";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";

type Option = { id: string; label: string };
type Mode = "none" | "existing" | "create";

function Choice({
  legend,
  mode,
  onMode,
  existing,
  onExisting,
  options,
  handle,
  onHandle,
  name,
  onName,
  allowNone,
}: {
  legend: string;
  mode: Mode;
  onMode: (mode: Mode) => void;
  existing: string;
  onExisting: (id: string) => void;
  options: Option[];
  handle: string;
  onHandle: (value: string) => void;
  name: { zh: string; en: string };
  onName: (value: { zh: string; en: string }) => void;
  allowNone: boolean;
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pw-label">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-small">
        {(allowNone ? (["none", "existing", "create"] as Mode[]) : (["existing", "create"] as Mode[])).map((value) => (
          <label key={value} className="flex min-h-8 items-center gap-2">
            <input type="radio" checked={mode === value} onChange={() => onMode(value)} />
            {value === "none"
              ? zh
                ? "不需要"
                : "Not needed"
              : value === "existing"
                ? zh
                  ? "选择已有"
                  : "Use existing"
                : zh
                  ? "新建"
                  : "Create new"}
          </label>
        ))}
      </div>
      {mode === "existing" ? (
        <select value={existing} onChange={(event) => onExisting(event.target.value)} className="pw-field text-small">
          <option value="">{zh ? "请选择…" : "Choose…"}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {mode === "create" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "代号" : "Handle"}</span>
            <input
              value={handle}
              onChange={(event) => onHandle(event.target.value.toLowerCase())}
              className="pw-field font-mono text-small"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "中文名" : "Chinese name"}</span>
            <input
              value={name.zh}
              onChange={(event) => onName({ ...name, zh: event.target.value })}
              className="pw-field text-small"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "英文名" : "English name"}</span>
            <input
              value={name.en}
              onChange={(event) => onName({ ...name, en: event.target.value })}
              className="pw-field text-small"
            />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * Approve (choosing or creating the author and the page) or reject (with a
 * reason the applicant reads). Both commit in one transaction; a second click
 * after a decision is refused, not repeated.
 */
export function ApplicationDecision({
  application,
  authors,
  members,
}: {
  application: IdentityApplication;
  authors: Option[];
  members: Option[];
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const wantsAuthor = application.kind !== "member";
  const wantsMember = application.kind !== "author";
  const handle = application.proposedHandle ?? application.account?.handle ?? "";
  const name = application.account?.name ?? { zh: "", en: "" };
  const [authorMode, setAuthorMode] = useState<Mode>(
    application.account?.authorId ? "none" : wantsAuthor ? "create" : "none",
  );
  const [memberMode, setMemberMode] = useState<Mode>(
    application.account?.memberId ? "none" : wantsMember ? "create" : "none",
  );
  const [authorExisting, setAuthorExisting] = useState("");
  const [memberExisting, setMemberExisting] = useState("");
  const [authorHandle, setAuthorHandle] = useState(handle);
  const [memberHandle, setMemberHandle] = useState(handle);
  const [authorName, setAuthorName] = useState(name);
  const [memberName, setMemberName] = useState(name);
  const choice = (mode: Mode, existing: string, h: string, n: { zh: string; en: string }): IdentityChoice | null =>
    mode === "existing" ? { mode, id: existing } : mode === "create" ? { mode, handle: h, name: n } : null;
  const who = application.account ? `${application.account.name[lang]} <${application.account.email}>` : application.id;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ConfirmAction
          plainTrigger
          trigger={<span className="pw-stamp-button [--draft:var(--color-moss-ink)]">{zh ? "批准" : "Approve"}</span>}
          title={zh ? "批准申请并绑定身份" : "Approve and bind"}
          description={
            <div className="flex flex-col gap-5">
              <p>
                {zh
                  ? `为 ${who} 选择或新建作者与成员主页。批准、新建记录与绑定在同一事务中完成；任一步失败都不会留下半完成的状态。`
                  : `Choose or create the author and page for ${who}. Approval, new records and bindings commit together; if any step fails, nothing is left half done.`}
              </p>
              <Choice
                legend={zh ? "Wiki 作者（决定可编辑的文章）" : "Wiki author (decides which entries they edit)"}
                mode={authorMode}
                onMode={setAuthorMode}
                existing={authorExisting}
                onExisting={setAuthorExisting}
                options={authors}
                handle={authorHandle}
                onHandle={setAuthorHandle}
                name={authorName}
                onName={setAuthorName}
                allowNone
              />
              <Choice
                legend={zh ? "成员主页（公开页面）" : "Member page (public)"}
                mode={memberMode}
                onMode={setMemberMode}
                existing={memberExisting}
                onExisting={setMemberExisting}
                options={members}
                handle={memberHandle}
                onHandle={setMemberHandle}
                name={memberName}
                onName={setMemberName}
                allowNone
              />
            </div>
          }
          reason={{ label: zh ? "给申请人的说明（可选）" : "Note to the applicant (optional)" }}
          confirmLabel={zh ? "批准并绑定" : "Approve and bind"}
          onConfirm={async (reason) => {
            await api(`/api/admin/applications/${application.id}`, "POST", {
              decision: "approved",
              reason,
              author: choice(authorMode, authorExisting, authorHandle, authorName),
              member: choice(memberMode, memberExisting, memberHandle, memberName),
            });
            succeed(zh ? "已批准，身份已绑定。" : "Approved; identities bound.");
          }}
        />
        <ConfirmAction
          tone="danger"
          trigger={zh ? "拒绝" : "Reject"}
          title={zh ? "拒绝这份申请？" : "Reject this application?"}
          description={
            zh
              ? `${who} 会在账号页看到拒绝原因，可以修改后重新申请。`
              : `${who} sees your reason on their account page and may apply again.`
          }
          reason={{ label: zh ? "拒绝原因（申请人可见）" : "Reason (shown to the applicant)", required: true }}
          confirmLabel={zh ? "拒绝申请" : "Reject application"}
          onConfirm={async (reason) => {
            await api(`/api/admin/applications/${application.id}`, "POST", { decision: "rejected", reason });
            succeed(zh ? "已拒绝。" : "Rejected.");
          }}
        />
      </div>
      <NoticeLine notice={notice} className="text-meta" />
    </div>
  );
}
