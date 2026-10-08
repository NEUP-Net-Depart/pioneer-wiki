"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import type { ContentVersion } from "@/lib/model/types";
import { useI18n } from "@/lib/i18n/client";
import { api, failureText, useAction } from "./actions";

/** Fields worth naming when two versions differ, with readable labels. */
const FIELDS: Record<string, [string, string]> = {
  name_zh: ["中文名", "Chinese name"],
  name_en: ["英文名", "English name"],
  role_zh: ["身份（中）", "Role (zh)"],
  role_en: ["身份（英）", "Role (en)"],
  bio_zh: ["简介（中）", "Bio (zh)"],
  bio_en: ["简介（英）", "Bio (en)"],
  about: ["自我介绍", "About"],
  links: ["链接", "Links"],
  github: ["GitHub", "GitHub"],
  projects: ["作品", "Works"],
  plate_emblem: ["藏书票图案", "Bookplate emblem"],
  plate_ink: ["藏书票墨色", "Bookplate ink"],
  plate_border: ["藏书票边框", "Bookplate border"],
  plate_motto: ["藏书票格言", "Bookplate motto"],
  cover_src: ["页首图", "Page image"],
  url: ["地址", "Address"],
  description_zh: ["介绍（中）", "Description (zh)"],
  description_en: ["介绍（英）", "Description (en)"],
  emblem: ["徽记", "Emblem"],
  since: ["加入日期", "Joined"],
  title_zh: ["中文标题", "Chinese title"],
  title_en: ["英文标题", "English title"],
  summary_zh: ["中文摘要", "Chinese summary"],
  summary_en: ["英文摘要", "English summary"],
  body: ["正文", "Account"],
  date: ["日期", "Date"],
  kind: ["类型", "Kind"],
  host_ids: ["参与者", "Participants"],
  resources: ["资源", "Resources"],
  tags: ["标签", "Tags"],
  archived_at: ["归档状态", "Archive state"],
  handle: ["主页地址", "Page address"],
};

function changed(a: Record<string, unknown>, b: Record<string, unknown> | undefined): string[] {
  if (!b) return [];
  return Object.keys(FIELDS).filter((key) => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null));
}

/**
 * The saved versions of a member page, link or chronicle: who saved which
 * fields when, and a way back. Restoring writes a new version; nothing is lost.
 */
export function VersionHistory({
  endpoint,
  restore,
  label,
}: {
  endpoint: string;
  restore: (n: number) => Promise<unknown>;
  label?: string;
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { succeed } = useAction();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const load = async () => {
    setError(null);
    try {
      setVersions((await api<{ versions: ContentVersion[] }>(endpoint, "GET")).versions);
    } catch (cause) {
      setError(failureText(cause, lang));
    }
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <Dialog.Trigger asChild>
        <button type="button" className="pw-link min-h-8 text-small text-ink-2">
          {label ?? (zh ? "版本" : "Versions")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-(--z-overlay) bg-veil" />
        <Dialog.Content className="pw-sheet fixed top-1/2 left-1/2 z-(--z-overlay) flex max-h-[calc(100svh-2rem)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto p-6 shadow-lifted sm:p-8">
          <Dialog.Title className="pw-double-rule font-display text-h3">{zh ? "版本记录" : "Versions"}</Dialog.Title>
          <Dialog.Description className="text-small text-ink-2">
            {zh
              ? "每次保存、归档或恢复都会留下一个版本。恢复旧版本会作为新版本保存，不会删除任何记录。"
              : "Every save, archive and restore leaves a version. Restoring an old one saves it as a new version; nothing is removed."}
          </Dialog.Description>
          {error ? (
            <p role="alert" className="text-small text-brick-ink">
              {error}
            </p>
          ) : null}
          {!versions && !error ? <p className="text-small text-ink-3">{zh ? "正在读取…" : "Loading…"}</p> : null}
          {versions && !versions.length ? (
            <p className="text-small text-ink-3">{zh ? "还没有版本记录。" : "No versions yet."}</p>
          ) : null}
          {versions?.length ? (
            <ol className="flex flex-col divide-y divide-rule">
              {versions.map((version, index) => {
                const fields = changed(version.data, versions[index + 1]?.data);
                return (
                  <li key={version.number} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-small text-ink">
                        <span className="font-mono">v{version.number}</span> · {version.note || "—"}
                      </p>
                      <p className="text-meta text-ink-3">
                        {new Date(version.createdAt).toLocaleString(zh ? "zh-CN" : "en-GB")}
                      </p>
                      {fields.length ? (
                        <p className="mt-1 text-meta text-ink-2">
                          {zh ? "改动：" : "Changed: "}
                          {fields.map((key) => FIELDS[key][zh ? 0 : 1]).join(zh ? "、" : ", ")}
                        </p>
                      ) : null}
                    </div>
                    {index > 0 && confirming !== version.number ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        className="pw-link min-h-8 text-small text-indigo disabled:opacity-45"
                        onClick={() => setConfirming(version.number)}
                      >
                        {zh ? "恢复此版本" : "Restore"}
                      </button>
                    ) : index > 0 ? (
                      <span className="flex flex-wrap items-center gap-3 text-small">
                        <span className="text-ink-2">
                          {zh ? `把 v${version.number} 设为最新？` : `Make v${version.number} current?`}
                        </span>
                        <button
                          type="button"
                          className="pw-link min-h-8 text-ink-3"
                          onClick={() => setConfirming(null)}
                        >
                          {zh ? "取消" : "Cancel"}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          className="pw-link min-h-8 text-small text-indigo disabled:opacity-45"
                          onClick={async () => {
                            setConfirming(null);
                            setBusy(version.number);
                            setError(null);
                            try {
                              await restore(version.number);
                              succeed(zh ? `已恢复 v${version.number} 的内容。` : `v${version.number} restored.`);
                              await load();
                            } catch (cause) {
                              setError(failureText(cause, lang));
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {busy === version.number ? (zh ? "恢复中…" : "Restoring…") : zh ? "确认恢复" : "Confirm"}
                        </button>
                      </span>
                    ) : (
                      <span className="text-meta text-ink-3">{zh ? "当前" : "Current"}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : null}
          <Dialog.Close asChild>
            <button type="button" className="pw-link min-h-11 self-end text-small text-ink-2">
              {zh ? "关闭" : "Close"}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
