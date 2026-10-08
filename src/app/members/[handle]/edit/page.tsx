import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { MemberEditor } from "@/components/members/MemberEditor";
import { AccessGate, gateReason } from "@/components/states/AccessGate";
import { MemberVersions } from "@/components/members/MemberVersions";
import { publicRepos } from "@/lib/members/github";

export const metadata: Metadata = { title: "编辑主页 Edit page", robots: { index: false } };

/** Editing a member page — by the account bound to it, or by an administrator on its behalf. */
export default async function EditMemberPage({ params }: PageProps<"/members/[handle]/edit">) {
  const { handle } = await params;
  const { community, auth } = getServices();
  const { lang } = await getT();
  const zh = lang === "zh";
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "verified");
  if (refused) return <AccessGate reason={refused} lang={lang} next={`/members/${handle}/edit`} />;
  const member = await community.getMember(handle, { includeArchived: true });
  if (!member) notFound();
  const own = account!.memberId === member.id;
  const admin = account!.role === "admin";
  if (!own && !admin) return <AccessGate reason="not_page_owner" lang={lang} next={`/members/${handle}`} />;
  const repositories = member.github ? await publicRepos(member.github, 30) : [];

  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead
        left={
          <Link href={`/members/${member.handle}`} transitionTypes={["nav-back"]} className="no-underline hover:text-ink">
            ← {member.name[lang]}
          </Link>
        }
        right={zh ? "编辑主页" : "Edit page"}
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-tight tracking-[-0.02em]">
            {own ? (zh ? "编辑我的主页" : "Edit my page") : zh ? `代为编辑：${member.name.zh}` : `Editing ${member.name.en}’s page`}
          </h1>
          <p className="mt-2 max-w-prose text-small text-ink-2">
            {zh
              ? "保存后立即公开。每次保存都会留下一个版本，可以从“版本记录”恢复。"
              : "Saving makes changes public at once. Every save keeps a version you can restore from Versions."}
          </p>
        </div>
        <MemberVersions handle={member.handle} />
      </div>
      {member.archivedAt && !admin ? (
        <p role="note" className="pw-sheet px-5 py-4 text-small text-ink-2">
          {zh ? "主页已归档，恢复前不能编辑。" : "The page is archived and cannot be edited until it is restored."}
        </p>
      ) : (
        <>
          {member.archivedAt ? (
            <p role="note" className="text-small text-gold-ink">
              {zh ? "这个主页已归档；你的修改会保存，但读者在恢复前看不到。" : "This page is archived; your edits are kept but readers see nothing until it is restored."}
            </p>
          ) : null}
          <MemberEditor member={member} repositories={repositories} />
        </>
      )}
    </div>
  );
}
