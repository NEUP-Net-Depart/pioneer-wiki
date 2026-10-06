import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { RunningHead } from "@/components/book/RunningHead";
import { ArchiveState } from "@/components/states/ArchiveState";
import { MemberEditor } from "@/components/members/MemberEditor";

export const metadata: Metadata = { title: "编辑主页 Edit page", robots: { index: false } };

/** Editing a member's page — open only to that member. */
export default async function EditMemberPage({ params }: PageProps<"/members/[handle]/edit">) {
  const { handle } = await params;
  const { community, auth } = getServices();
  const [member, user] = await Promise.all([community.getMember(handle), auth.getCurrentUser()]);
  if (!member) notFound();
  const { lang } = await getT();
  const zh = lang === "zh";
  const own = Boolean(user && member.authorId === user.id);

  return (
    <div className="flex flex-col gap-(--space-block)">
      <RunningHead
        left={
          <Link
            href={`/members/${member.handle}`}
            transitionTypes={["nav-back"]}
            className="no-underline hover:text-ink"
          >
            ← {member.name[lang]}
          </Link>
        }
        right={zh ? "编辑主页" : "Edit page"}
      />
      {own ? (
        <>
          <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-tight tracking-[-0.02em]">
            {zh ? "编辑我的主页" : "Edit my page"}
          </h1>
          <MemberEditor member={member} />
        </>
      ) : (
        <ArchiveState
          kind="empty"
          title={zh ? `只有${member.name.zh}本人可以编辑这个主页。` : `Only ${member.name.en} can edit this page.`}
          code="403"
        />
      )}
    </div>
  );
}
