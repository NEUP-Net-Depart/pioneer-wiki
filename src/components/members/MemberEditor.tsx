"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BorderId, InkId, Member, MemberPatch } from "@/lib/model/types";
import { BORDERS, EMBLEMS, INKS } from "@/lib/model/vocab";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/markdown/Markdown";
import { NotebookSheet } from "@/components/writing/NotebookSheet";
import { Bookplate, Emblem } from "./Bookplate";
import { BookplateDownload } from "./BookplateDownload";
import { Frontispiece } from "./Frontispiece";

type Feedback = { kind: "ok" | "error"; text: string } | null;

async function send(url: string, init: RequestInit): Promise<Member> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
  return json as Member;
}

function Section({ n, title, hint, children }: { n: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="pw-ink-over flex flex-col gap-5 pt-6">
      <header className="flex items-baseline gap-4">
        <span className="font-display text-h3 italic" style={{ color: "var(--plate-ink)" }}>
          {n}
        </span>
        <span>
          <h2 className="font-display text-h3">{title}</h2>
          {hint ? <p className="text-small text-ink-3">{hint}</p> : null}
        </span>
      </header>
      {children}
    </section>
  );
}

/**
 * Editing one's own page: the bookplate studio (emblem, ink, border, motto —
 * with a live plate beside it), the large page image, the name card, the long
 * self-introduction on the notebook pad, and links. Saves with PATCH
 * /api/members/[handle]; the image uploads on its own (POST …/cover).
 */
export function MemberEditor({ member: initial }: { member: Member }) {
  const router = useRouter();
  const { lang } = useI18n();
  const zh = lang === "zh";
  const [member, setMember] = useState(initial);
  const [plate, setPlate] = useState(initial.plate);
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [bio, setBio] = useState(initial.bio);
  const [about, setAbout] = useState(initial.about);
  const [links, setLinks] = useState(initial.links);
  const [github, setGithub] = useState(initial.github ?? "");
  const [print, setPrint] = useState(initial.cover?.print ?? "original");
  const [busy, setBusy] = useState<null | "save" | "upload">(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const file = useRef<HTMLInputElement>(null);
  const ink = INKS[plate.ink].hex;
  const base = `/api/members/${member.handle}`;

  const save = async () => {
    setBusy("save");
    setFeedback(null);
    try {
      const patch: MemberPatch = {
        name,
        role,
        bio,
        about,
        links: links.filter((l) => l.label.trim() || l.url.trim()),
        github: github.trim() || null,
        plate: { emblem: plate.emblem, ink: plate.ink, border: plate.border, motto: plate.motto },
        coverPrint: print,
      };
      const next = await send(base, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      setMember(next);
      setFeedback({ kind: "ok", text: zh ? "已保存。" : "Saved." });
      router.refresh();
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (f: File) => {
    setBusy("upload");
    setFeedback(null);
    try {
      const form = new FormData();
      form.append("file", f);
      form.append("print", print);
      const next = await send(`${base}/cover`, { method: "POST", body: form });
      setMember(next);
      setFeedback({ kind: "ok", text: zh ? "主页大图已更换。" : "Page image replaced." });
      router.refresh();
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      if (file.current) file.current.value = "";
    }
  };

  const removeCover = async () => {
    setBusy("upload");
    try {
      setMember(await send(`${base}/cover`, { method: "DELETE" }));
      router.refresh();
    } catch (e) {
      setFeedback({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { lang?: string; max?: number; className?: string } = {},
  ) => (
    <label className="flex flex-col gap-1">
      <span className="pw-label">{label}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        lang={opts.lang}
        maxLength={opts.max}
        className={cn("pw-field", opts.className)}
      />
    </label>
  );

  return (
    <div className="grid gap-(--space-block) lg:grid-cols-12" style={{ "--plate-ink": ink } as React.CSSProperties}>
      {/* The plate as it will print, kept in view while choosing. */}
      <aside className="lg:col-span-4">
        <div className="flex flex-col items-center gap-5 lg:sticky lg:top-[calc(var(--shell-header)+2rem)]">
          <Bookplate plate={plate} name={name} lang={lang} pasted className="w-60 sm:w-72" />
          <BookplateDownload plate={plate} name={name} handle={member.handle} lang={lang} />
        </div>
      </aside>

      <div className="flex flex-col gap-(--space-block) lg:col-span-8">
        <Section
          n="I"
          title={zh ? "藏书票" : "Bookplate"}
          hint={
            zh
              ? "挑一件象征物、一种墨色和一款边框，再写一句座右铭。"
              : "Pick an emblem, an ink and a border, and write a motto."
          }
        >
          <div
            role="radiogroup"
            aria-label={zh ? "象征物" : "Emblem"}
            className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8"
          >
            {EMBLEMS.map((e) => (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={plate.emblem === e.id}
                aria-label={e.name[lang]}
                title={e.name[lang]}
                onClick={() => setPlate({ ...plate, emblem: e.id })}
                className="pw-pick aspect-square p-2"
              >
                <Emblem emblem={e.id} ink={plate.ink} className="w-full" />
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label={zh ? "墨色" : "Ink"} className="flex flex-wrap gap-3">
            {(Object.keys(INKS) as InkId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={plate.ink === id}
                onClick={() => setPlate({ ...plate, ink: id })}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-rule py-1 pr-3 pl-1 text-small transition-colors duration-(--dur-quick)",
                  plate.ink === id ? "border-ink text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-5 rounded-full"
                  style={{
                    background: INKS[id].hex,
                    boxShadow: plate.ink === id ? `0 0 0 2px #f7f2e6, 0 0 0 3px ${INKS[id].hex}` : undefined,
                  }}
                />
                {INKS[id].name[lang]}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label={zh ? "边框" : "Border"} className="grid grid-cols-4 gap-3">
            {(Object.keys(BORDERS) as BorderId[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={plate.border === id}
                onClick={() => setPlate({ ...plate, border: id })}
                className="pw-pick flex-col gap-2 p-3"
              >
                <span
                  aria-hidden="true"
                  className="block aspect-[2/3] w-full bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:100%_100%]"
                  style={{
                    color: ink,
                    maskImage: `url(/vignettes/web/${BORDERS[id].frame}.webp)`,
                    WebkitMaskImage: `url(/vignettes/web/${BORDERS[id].frame}.webp)`,
                  }}
                />
                <span className="text-meta text-ink-2">{BORDERS[id].name[lang]}</span>
              </button>
            ))}
          </div>
          {field(
            zh ? "座右铭（印在飘带上）" : "Motto (set on the ribbon)",
            plate.motto,
            (v) => setPlate({ ...plate, motto: v }),
            { max: 48, className: "font-display text-lead italic" },
          )}
        </Section>

        <Section
          n="II"
          title={zh ? "主页大图" : "Page image"}
          hint={
            zh
              ? "放在主页顶部的一张大图（扉页）。JPEG / PNG / WebP，最大 15 MB。"
              : "The large image across the top of your page — your frontispiece. JPEG / PNG / WebP, up to 15 MB."
          }
        >
          <Frontispiece
            cover={member.cover ? { ...member.cover, print } : undefined}
            ink={plate.ink}
            alt=""
            fade={false}
            className="aspect-[16/7] w-full rounded-sm"
          />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <input
              ref={file}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="sr-only"
              id="pw-cover-file"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <label
              htmlFor="pw-cover-file"
              className={cn(
                "inline-flex h-9 cursor-pointer items-center rounded-sm px-4 text-small text-paper-sheet",
                busy && "pointer-events-none opacity-50",
              )}
              style={{ background: ink }}
            >
              {busy === "upload"
                ? zh
                  ? "上传中…"
                  : "Uploading…"
                : member.cover
                  ? zh
                    ? "更换图片…"
                    : "Replace image…"
                  : zh
                    ? "选择图片…"
                    : "Choose image…"}
            </label>
            <div role="radiogroup" aria-label={zh ? "印法" : "Print"} className="flex gap-4 text-small">
              {(["original", "ink"] as const).map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="print"
                    checked={print === p}
                    onChange={() => setPrint(p)}
                    className="accent-current"
                    style={{ color: ink }}
                  />
                  {p === "original"
                    ? zh
                      ? "原色"
                      : "Original colour"
                    : zh
                      ? `以${INKS[plate.ink].name.zh}印刷`
                      : `Printed in ${INKS[plate.ink].name.en}`}
                </label>
              ))}
            </div>
            {member.cover ? (
              <button
                type="button"
                onClick={removeCover}
                disabled={Boolean(busy)}
                className="pw-link text-small text-ink-3 hover:text-brick-ink"
              >
                {zh ? "移除（换回大理石纹衬纸）" : "Remove (back to marbled endpaper)"}
              </button>
            ) : null}
          </div>
        </Section>

        <Section n="III" title={zh ? "名片" : "Name card"}>
          <div className="grid gap-5 sm:grid-cols-2">
            {field(zh ? "中文名" : "Name (Chinese)", name.zh, (v) => setName({ ...name, zh: v }), {
              lang: "zh-CN",
              max: 40,
              className: "font-display text-h4",
            })}
            {field(zh ? "英文名" : "Name (English)", name.en, (v) => setName({ ...name, en: v }), {
              lang: "en",
              max: 40,
              className: "font-display text-h4",
            })}
            {field(zh ? "角色（中文）" : "Role (Chinese)", role.zh, (v) => setRole({ ...role, zh: v }), {
              lang: "zh-CN",
              max: 40,
            })}
            {field(zh ? "角色（英文）" : "Role (English)", role.en, (v) => setRole({ ...role, en: v }), {
              lang: "en",
              max: 40,
            })}
            {field(zh ? "一句话简介（中文）" : "One line (Chinese)", bio.zh, (v) => setBio({ ...bio, zh: v }), {
              lang: "zh-CN",
              max: 160,
            })}
            {field(zh ? "一句话简介（英文）" : "One line (English)", bio.en, (v) => setBio({ ...bio, en: v }), {
              lang: "en",
              max: 160,
            })}
          </div>
        </Section>

        <Section
          n="IV"
          title={zh ? "自述" : "About"}
          hint={zh ? "支持 Markdown 与 :::zh / :::en 双语块。" : "Markdown, with :::zh / :::en bilingual blocks."}
        >
          <div className="grid gap-8 xl:grid-cols-2">
            <NotebookSheet
              value={about}
              onChange={setAbout}
              lang={lang}
              mono
              label={zh ? "自述 · 撰写" : "About · Writing"}
              head={[
                [zh ? "成员" : "Member", `@${member.handle}`],
                [zh ? "藏书票" : "Plate", `No. ${String(plate.number).padStart(3, "0")}`],
              ]}
              hint="Markdown"
              className="min-h-[24rem]"
            />
            <div className="pw-proof min-h-[24rem] px-6 pt-10 pb-8">
              <i aria-hidden="true" />
              <i aria-hidden="true" />
              <i aria-hidden="true" />
              <i aria-hidden="true" />
              <Markdown lang={lang}>{about}</Markdown>
            </div>
          </div>
        </Section>

        <Section
          n="V"
          title={zh ? "别处" : "Elsewhere"}
          hint={
            zh
              ? "其他能找到你的地方；GitHub 帐号会在主页上列出你的公开仓库。"
              : "Where else to find you; a GitHub login lists your public repositories on your page."
          }
        >
          {field("GitHub", github, setGithub, { max: 39, className: "font-mono text-small" })}
          <ol className="flex flex-col gap-3">
            {links.map((l, i) => (
              <li key={i} className="grid grid-cols-[8rem_1fr_auto] items-end gap-3">
                {field(
                  zh ? "名称" : "Label",
                  l.label,
                  (v) => setLinks(links.map((x, k) => (k === i ? { ...x, label: v } : x))),
                  { max: 32 },
                )}
                {field(
                  zh ? "地址" : "Address",
                  l.url,
                  (v) => setLinks(links.map((x, k) => (k === i ? { ...x, url: v } : x))),
                  { max: 300, className: "font-mono text-small" },
                )}
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, k) => k !== i))}
                  className="pb-2 text-small text-ink-3 hover:text-brick-ink"
                  aria-label={zh ? "删除这条链接" : "Remove this link"}
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
          {links.length < 8 ? (
            <button
              type="button"
              onClick={() => setLinks([...links, { label: "", url: "https://" }])}
              className="pw-link self-start text-small"
              style={{ color: ink }}
            >
              + {zh ? "添加一条链接" : "Add a link"}
            </button>
          ) : null}
        </Section>

        <div
          aria-busy={Boolean(busy) || undefined}
          className="pw-ink-over sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-4 bg-paper/95 px-4 py-4 sm:-mx-6 sm:px-6"
        >
          <button
            type="button"
            onClick={save}
            disabled={Boolean(busy)}
            className="h-10 rounded-sm px-5 text-small text-paper-sheet disabled:opacity-50"
            style={{ background: ink }}
          >
            {busy === "save" ? (zh ? "保存中…" : "Saving…") : zh ? "保存主页" : "Save my page"}
          </button>
          <Link href={`/members/${member.handle}`} className="pw-link text-small text-ink-2">
            {zh ? "查看主页" : "View my page"} →
          </Link>
          <p
            role={feedback?.kind === "error" ? "alert" : "status"}
            className={cn("text-small", feedback?.kind === "error" ? "text-brick-ink" : "text-ink-3")}
          >
            {feedback?.text ?? ""}
          </p>
        </div>
      </div>
    </div>
  );
}
