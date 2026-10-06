import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getT } from "@/lib/i18n/server";
import { getServices } from "@/lib/services";
import { DOMAIN_IDS } from "@/lib/model/vocab";
import { frontispiece } from "@/mock/frontispiece";
import { EntranceStage, type StageFrame } from "@/components/home/EntranceStage";
import { PartTransition } from "@/components/motion/PartTransition";

function stageFrames(): Record<string, StageFrame> {
  try {
    const list = JSON.parse(
      readFileSync(join(process.cwd(), "public", "stage", "frames.json"), "utf8"),
    ) as StageFrame[];
    return Object.fromEntries(list.map((f) => [f.name, f]));
  } catch {
    return {};
  }
}

/**
 * The entrance shared by the four parts (/, /links, /members, /forum): one
 * stage that stays mounted while the reader moves between them, and the
 * current part's content below it.
 */
export default async function EntranceLayout({ children }: LayoutProps<"/">) {
  const { lang } = await getT();
  const zh = lang === "zh";
  const { entries, community } = getServices();
  const [all, links, members, threads] = await Promise.all([
    entries.listEntries(),
    community.listLinks(),
    community.listMembers(),
    community.listThreads(),
  ]);
  const meta = {
    wiki: zh
      ? `${all.length} 件标本 · ${DOMAIN_IDS.length} 门`
      : `${all.length} specimens · ${DOMAIN_IDS.length} phyla`,
    links: zh ? `${links.length} 处港口` : `${links.length} harbours`,
    members: zh ? `${members.length} 位成员` : `${members.length} in the cast`,
    forum: zh ? `${threads.length} 张图纸` : `${threads.length} sheets on the register`,
  };

  return (
    <div className="flex flex-col">
      <EntranceStage frames={stageFrames()} lang={lang} meta={meta} seed={frontispiece.seed} />
      <PartTransition>{children}</PartTransition>
    </div>
  );
}
