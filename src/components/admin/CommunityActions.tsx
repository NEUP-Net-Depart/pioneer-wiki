"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChronicleDetail, ChronicleKind, ChronicleResource, FriendLink, Member } from "@/lib/model/types";
import { CHRONICLE_KINDS, CHRONICLE_RESOURCE_KINDS } from "@/lib/model/vocab";
import { useI18n } from "@/lib/i18n/client";
import { api, ConfirmAction, NoticeLine, useAction } from "./actions";
import { VersionHistory } from "./VersionHistory";

/* Forms and actions for member pages, friend links and the annals. */

function Pair({
  label,
  value,
  onChange,
  max,
  multiline,
}: {
  label: string;
  value: { zh: string; en: string };
  onChange: (value: { zh: string; en: string }) => void;
  max: number;
  multiline?: boolean;
}) {
  const { lang } = useI18n();
  const Field = multiline ? "textarea" : "input";
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="pw-label mb-1 sm:col-span-2">{label}</legend>
      {(["zh", "en"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-meta text-ink-3">{key === "zh" ? (lang === "zh" ? "中文" : "Chinese") : lang === "zh" ? "英文" : "English"}</span>
          <Field
            value={value[key]}
            maxLength={max}
            lang={key === "zh" ? "zh-CN" : "en"}
            onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [key]: event.target.value })}
            className={multiline ? "pw-lined min-h-20 resize-y text-small" : "pw-field text-small"}
          />
        </label>
      ))}
    </fieldset>
  );
}

function Archive({
  archived,
  title,
  endpoint,
  what,
}: {
  archived: boolean;
  title: string;
  endpoint: string;
  what: { zh: string; en: string; zhEffect: string; enEffect: string };
}) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  return (
    <>
      {archived ? (
        <ConfirmAction
          trigger={zh ? "恢复" : "Restore"}
          title={zh ? `恢复${what.zh}「${title}」？` : `Restore the ${what.en} “${title}”?`}
          description={zh ? "恢复后重新公开，内容与历史不变。" : "It becomes public again with its content and history intact."}
          confirmLabel={zh ? `恢复${what.zh}` : `Restore ${what.en}`}
          onConfirm={async () => {
            await api(endpoint, "POST", { archived: false });
            succeed(zh ? "已恢复。" : "Restored.");
          }}
        />
      ) : (
        <ConfirmAction
          tone="danger"
          trigger={zh ? "归档" : "Archive"}
          title={zh ? `归档${what.zh}「${title}」？` : `Archive the ${what.en} “${title}”?`}
          description={zh ? what.zhEffect : what.enEffect}
          reason={{ label: zh ? "归档原因（记入审计）" : "Reason (audit log)" }}
          confirmLabel={zh ? `归档${what.zh}` : `Archive ${what.en}`}
          onConfirm={async (reason) => {
            await api(endpoint, "POST", { archived: true, reason });
            succeed(zh ? "已归档，可在回收站恢复。" : "Archived; restore it from the archive bin.");
          }}
        />
      )}
      <NoticeLine notice={notice} className="w-full text-meta" />
    </>
  );
}

// ── Members ────────────────────────────────────────────────────────────────

export function MemberRowActions({ member }: { member: Member }) {
  const { lang } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a href={`/members/${member.handle}/edit`} className="pw-link min-h-8 text-small text-ink">
        {lang === "zh" ? "编辑主页" : "Edit page"}
      </a>
      <VersionHistory
        endpoint={`/api/members/${member.handle}/versions`}
        restore={(n) => api(`/api/members/${member.handle}/versions`, "POST", { number: n })}
      />
      <Archive
        archived={Boolean(member.archivedAt)}
        title={member.name[lang]}
        endpoint={`/api/admin/members/${member.handle}/archive`}
        what={{
          zh: "成员主页",
          en: "member page",
          zhEffect: "主页从成员名册和公开地址中隐藏；账号、绑定、作品与藏书票都保留。本人仍可看到主页并收到归档提示。",
          enEffect: "The page leaves the roll and its public address; the account, its binding, works and bookplate are kept. The member still sees it, with a notice.",
        }}
      />
    </div>
  );
}

export function NewMember() {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [name, setName] = useState({ zh: "", en: "" });
  const [role, setRole] = useState({ zh: "成员", en: "Member" });
  return (
    <ConfirmAction
      plainTrigger
      trigger={<span className="pw-stamp-button [--draft:var(--color-ink)]">{zh ? "新建成员主页" : "New member page"}</span>}
      title={zh ? "新建成员主页" : "New member page"}
      description={
        <div className="flex flex-col gap-4">
          <p>{zh ? "新主页立即公开。之后可在账号页把它绑定给某个账号，由本人继续编辑。" : "The page is public at once. Bind it to an account afterwards so its owner can edit it."}</p>
          <label className="flex flex-col gap-1">
            <span className="pw-label">{zh ? "主页地址 /members/…" : "Address /members/…"}</span>
            <input value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} className="pw-field font-mono text-small" />
          </label>
          <Pair label={zh ? "姓名" : "Name"} value={name} onChange={setName} max={40} />
          <Pair label={zh ? "身份" : "Role"} value={role} onChange={setRole} max={40} />
        </div>
      }
      confirmLabel={zh ? "建立主页" : "Create page"}
      onConfirm={async () => {
        const member = await api<Member>("/api/admin/members", "POST", { handle, name, role });
        router.push(`/members/${member.handle}/edit`);
      }}
    />
  );
}

// ── Friend links ───────────────────────────────────────────────────────────

export const LINK_EMBLEMS = ["geo-compass", "geo-globe", "geo-islands", "geo-lighthouse", "geo-sextant", "geo-ship"];

export function LinkForm({ link }: { link?: FriendLink }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const [name, setName] = useState(link?.name ?? { zh: "", en: "" });
  const [description, setDescription] = useState(link?.description ?? { zh: "", en: "" });
  const [url, setUrl] = useState(link?.url ?? "https://");
  const [emblem, setEmblem] = useState(link?.emblem ?? "geo-compass");
  const [since, setSince] = useState(link?.since?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [sample, setSample] = useState(link?.sample ?? false);
  const urlInvalid = !/^https?:\/\/[^\s/]+/i.test(url);
  return (
    <>
      <ConfirmAction
        plainTrigger={!link}
        trigger={link ? (zh ? "编辑" : "Edit") : <span className="pw-stamp-button [--draft:var(--color-ink)]">{zh ? "新增友链" : "New link"}</span>}
        title={link ? (zh ? `编辑友链「${link.name[lang]}」` : `Edit “${link.name[lang]}”`) : zh ? "新增友链" : "New friend link"}
        description={
          <div className="flex flex-col gap-4">
            <Pair label={zh ? "名称" : "Name"} value={name} onChange={setName} max={60} />
            <label className="flex flex-col gap-1">
              <span className="pw-label">{zh ? "地址（http 或 https）" : "Address (http or https)"}</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value.trim())}
                aria-invalid={urlInvalid || undefined}
                inputMode="url"
                className="pw-field font-mono text-small break-all"
              />
              {urlInvalid ? <span className="text-meta text-brick-ink">{zh ? "请填写 http(s) 开头的完整地址。" : "Use a full http(s) address."}</span> : null}
            </label>
            <Pair label={zh ? "介绍" : "Description"} value={description} onChange={setDescription} max={240} multiline />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "徽记" : "Emblem"}</span>
                <select value={emblem} onChange={(event) => setEmblem(event.target.value)} className="pw-field text-small">
                  {LINK_EMBLEMS.map((value) => (
                    <option key={value} value={value}>
                      {value.replace("geo-", "")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "加入日期（决定地图顺序）" : "Joined (orders the chart)"}</span>
                <input type="date" value={since} onChange={(event) => setSince(event.target.value)} className="pw-field text-small" />
              </label>
            </div>
            <label className="flex min-h-8 items-center gap-2 text-small">
              <input type="checkbox" checked={sample} onChange={(event) => setSample(event.target.checked)} />
              {zh ? "示例数据（页面会标注“示例”）" : "Sample data (marked as a sample on the page)"}
            </label>
          </div>
        }
        confirmLabel={link ? (zh ? "保存友链" : "Save link") : zh ? "加入友链" : "Add link"}
        onConfirm={async () => {
          const patch = { name, url, description, emblem, since, sample };
          if (link) await api(`/api/admin/links/${link.id}`, "PATCH", { patch, baseVersion: link.version });
          else await api("/api/admin/links", "POST", patch);
          succeed(zh ? "友链已保存，目录与地图已更新。" : "Saved; the directory and chart are updated.");
        }}
      />
      {link ? null : <NoticeLine notice={notice} className="text-meta" />}
    </>
  );
}

export function LinkRowActions({ link }: { link: FriendLink }) {
  const { lang } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <LinkForm link={link} />
      <VersionHistory
        endpoint={`/api/admin/versions?kind=link&id=${encodeURIComponent(link.id)}`}
        restore={(n) => api("/api/admin/versions", "POST", { kind: "link", id: link.id, number: n })}
      />
      <Archive
        archived={Boolean(link.archivedAt)}
        title={link.name[lang]}
        endpoint={`/api/admin/links/${link.id}`}
        what={{
          zh: "友链",
          en: "link",
          zhEffect: "友链从目录与地图上移除，其余领地按加入顺序重新分配；记录与版本保留。",
          enEffect: "The link leaves the directory and the chart, whose territories are redrawn in joining order; its record and versions stay.",
        }}
      />
    </div>
  );
}

// ── The annals ─────────────────────────────────────────────────────────────

export function ChronicleForm({ record, members }: { record?: ChronicleDetail; members: Array<{ id: string; label: string }> }) {
  const { lang } = useI18n();
  const zh = lang === "zh";
  const { notice, succeed } = useAction();
  const [date, setDate] = useState(record?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<ChronicleKind>(record?.kind ?? "meeting");
  const [title, setTitle] = useState(record?.title ?? { zh: "", en: "" });
  const [summary, setSummary] = useState(record?.summary ?? { zh: "", en: "" });
  const [body, setBody] = useState(record?.body ?? "");
  const [hosts, setHosts] = useState<string[]>(record?.hostIds ?? []);
  const [tags, setTags] = useState((record?.tags ?? []).join(", "));
  const [resources, setResources] = useState<ChronicleResource[]>(record?.resources ?? []);
  const [sample, setSample] = useState(record?.sample ?? false);
  const resource = (index: number, patch: Partial<ChronicleResource>) =>
    setResources((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  return (
    <>
      <ConfirmAction
        plainTrigger={!record}
        trigger={record ? (zh ? "编辑" : "Edit") : <span className="pw-stamp-button [--draft:var(--color-ink)]">{zh ? "新增纪行" : "New record"}</span>}
        title={record ? (zh ? `编辑 No. ${String(record.number).padStart(3, "0")}` : `Edit No. ${String(record.number).padStart(3, "0")}`) : zh ? "新增纪行" : "New record"}
        description={
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "日期" : "Date"}</span>
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="pw-field text-small" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="pw-label">{zh ? "类型" : "Kind"}</span>
                <select value={kind} onChange={(event) => setKind(event.target.value as ChronicleKind)} className="pw-field text-small">
                  {(Object.keys(CHRONICLE_KINDS) as ChronicleKind[]).map((value) => (
                    <option key={value} value={value}>
                      {CHRONICLE_KINDS[value].label[lang]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Pair label={zh ? "标题" : "Title"} value={title} onChange={setTitle} max={120} />
            <Pair label={zh ? "摘要" : "Summary"} value={summary} onChange={setSummary} max={400} multiline />
            <label className="flex flex-col gap-1">
              <span className="pw-label">{zh ? "记述（Markdown，可用 :::zh / :::en）" : "Account (Markdown; :::zh / :::en allowed)"}</span>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} className="pw-lined min-h-32 resize-y font-mono text-small" />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="pw-label">{zh ? "主持与参与者" : "Hosts and participants"}</legend>
              <div className="flex max-h-36 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
                {members.map((member) => (
                  <label key={member.id} className="flex min-h-8 items-center gap-2 text-small">
                    <input
                      type="checkbox"
                      checked={hosts.includes(member.id)}
                      onChange={(event) => setHosts((list) => (event.target.checked ? [...list, member.id] : list.filter((id) => id !== member.id)))}
                    />
                    {member.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-3">
              <legend className="pw-label">{zh ? "录像与资料（外部链接）" : "Recordings and material (external links)"}</legend>
              {resources.map((item, index) => (
                <div key={index} className="grid gap-2 border-l-2 border-rule pl-3 sm:grid-cols-[8rem_1fr]">
                  <select value={item.kind} onChange={(event) => resource(index, { kind: event.target.value as ChronicleResource["kind"] })} className="pw-field text-small">
                    {(Object.keys(CHRONICLE_RESOURCE_KINDS) as Array<ChronicleResource["kind"]>).map((value) => (
                      <option key={value} value={value}>
                        {CHRONICLE_RESOURCE_KINDS[value][lang]}
                      </option>
                    ))}
                  </select>
                  <input value={item.url} placeholder="https://" onChange={(event) => resource(index, { url: event.target.value.trim() })} className="pw-field font-mono text-small" />
                  <input value={item.label.zh} placeholder={zh ? "中文标签" : "Chinese label"} onChange={(event) => resource(index, { label: { ...item.label, zh: event.target.value } })} className="pw-field text-small" />
                  <input value={item.label.en} placeholder={zh ? "英文标签" : "English label"} onChange={(event) => resource(index, { label: { ...item.label, en: event.target.value } })} className="pw-field text-small" />
                  <button type="button" className="pw-link min-h-8 justify-self-start text-meta text-brick-ink sm:col-span-2" onClick={() => setResources((list) => list.filter((_, i) => i !== index))}>
                    {zh ? "移除这一项" : "Remove"}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="pw-link min-h-8 self-start text-small text-ink"
                onClick={() => setResources((list) => [...list, { kind: "link", label: { zh: "", en: "" }, url: "https://" }])}
              >
                + {zh ? "添加资源" : "Add a resource"}
              </button>
            </fieldset>
            <label className="flex flex-col gap-1">
              <span className="pw-label">{zh ? "标签（逗号分隔）" : "Tags (comma-separated)"}</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className="pw-field text-small" />
            </label>
            <label className="flex min-h-8 items-center gap-2 text-small">
              <input type="checkbox" checked={sample} onChange={(event) => setSample(event.target.checked)} />
              {zh ? "示例数据（页面会标注“示例”）" : "Sample data (marked as a sample)"}
            </label>
          </div>
        }
        confirmLabel={record ? (zh ? "保存纪行" : "Save record") : zh ? "加入编年册" : "Add to the annals"}
        onConfirm={async () => {
          const patch = {
            date,
            kind,
            title,
            summary,
            body: body.trim() ? body : null,
            hostIds: hosts,
            resources,
            tags: tags
              .split(/[,，]/)
              .map((t) => t.trim())
              .filter(Boolean),
            sample,
          };
          if (record) await api(`/api/admin/chronicles/${record.id}`, "PATCH", { patch, baseVersion: record.version });
          else await api("/api/admin/chronicles", "POST", patch);
          succeed(zh ? "纪行已保存。" : "Record saved.");
        }}
      />
      {record ? null : <NoticeLine notice={notice} className="text-meta" />}
    </>
  );
}

export function ChronicleRowActions({ record, members }: { record: ChronicleDetail; members: Array<{ id: string; label: string }> }) {
  const { lang } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <ChronicleForm record={record} members={members} />
      <VersionHistory
        endpoint={`/api/admin/versions?kind=chronicle&id=${encodeURIComponent(record.id)}`}
        restore={(n) => api("/api/admin/versions", "POST", { kind: "chronicle", id: record.id, number: n })}
      />
      <Archive
        archived={Boolean(record.archivedAt)}
        title={record.title[lang]}
        endpoint={`/api/admin/chronicles/${record.id}`}
        what={{
          zh: "纪行",
          en: "record",
          zhEffect: "记录从编年册与成员页中隐藏；编号、内容与版本保留，可随时恢复。",
          enEffect: "The record leaves the annals and member pages; its number, content and versions stay and can be restored.",
        }}
      />
    </div>
  );
}
