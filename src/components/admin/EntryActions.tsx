"use client";

import { useState } from "react";
import type { EditorialEntry } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";

/** Archive / restore and the address of one entry, for administrators. */
export function EntryAdminActions({ entry }: { entry: EditorialEntry }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const [slug, setSlug] = useState(entry.slug);
  const title = entry.title[lang] || entry.title.zh || entry.title.en;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {entry.archivedAt ? (
          <ConfirmAction
            trigger={zh ? "恢复" : "Restore"}
            title={zh ? `恢复《${title}》？` : `Restore “${title}”?`}
            description={
              zh
                ? "恢复后，条目的公开版本重新出现在首页、检索、图谱和分类中；历史与关联保持不变。"
                : "Its public version returns to the home page, search, the graph and the catalogue; history and relations are unchanged."
            }
            confirmLabel={zh ? "恢复条目" : "Restore entry"}
            onConfirm={async () => {
              await api(`/api/admin/entries/${entry.id}/archive`, "POST", { archived: false });
              succeed(zh ? `《${title}》已恢复。` : `“${title}” restored.`);
            }}
          />
        ) : (
          <ConfirmAction
            tone="danger"
            trigger={zh ? "归档" : "Archive"}
            title={zh ? `归档《${title}》？` : `Archive “${title}”?`}
            description={
              <>
                <p>
                  {zh
                    ? "归档后，读者将无法通过任何公开入口看到它；修订历史、关联与审计全部保留，可在回收站恢复。"
                    : "Readers will no longer find it anywhere; its revisions, relations and audit trail stay, and it can be restored from the archive bin."}
                </p>
                {entry.status === "in_review" ? (
                  <p className="mt-2 text-brick-ink">
                    {zh ? "它正在等待审核；归档期间不能发布。" : "It is waiting for review and cannot be published while archived."}
                  </p>
                ) : null}
              </>
            }
            confirmLabel={zh ? "归档条目" : "Archive entry"}
            reason={{ label: zh ? "归档原因（记入审计）" : "Reason (kept in the audit log)" }}
            onConfirm={async (reason) => {
              await api(`/api/admin/entries/${entry.id}/archive`, "POST", { archived: true, reason });
              succeed(zh ? `《${title}》已归档，可在回收站恢复。` : `“${title}” archived; restore it from the archive bin.`);
            }}
          />
        )}
        <ConfirmAction
          trigger={zh ? "改地址" : "Address"}
          title={zh ? "修改条目地址" : "Change the entry address"}
          description={
            <div className="flex flex-col gap-3">
              <p>
                {zh
                  ? "旧地址会继续跳转到新地址，外部链接不会失效。只能使用小写字母、数字和连字符。"
                  : "The old address keeps redirecting, so links elsewhere still work. Use lowercase letters, digits and hyphens."}
              </p>
              <label className="flex flex-col gap-1">
                <span className="pw-label">/entries/</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="pw-field font-mono text-small"
                  aria-label={zh ? "新地址" : "New address"}
                />
              </label>
            </div>
          }
          confirmLabel={zh ? "保存新地址" : "Save the address"}
          onConfirm={async () => {
            await api(`/api/admin/entries/${entry.id}/slug`, "POST", { slug });
            succeed(zh ? "地址已更新，旧地址会跳转。" : "Address changed; the old one redirects.");
          }}
        />
      </div>
      <NoticeLine notice={notice} className="text-meta" />
    </div>
  );
}
