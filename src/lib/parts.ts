import type { Localized } from "@/lib/model/types";

/*
 * The four parts of the site, each printed in its own 19th-century manner and
 * entered from the same stage, which shows the same composition in the part's
 * manner: biology, geography, fine art, engineering blueprint.
 */

export type PartId = "wiki" | "links" | "members" | "forum";
export type StageTheme = "biology" | "geography" | "art" | "blueprint";

export interface PartMeta {
  id: PartId;
  href: "/" | "/links" | "/members" | "/forum";
  theme: StageTheme;
  numeral: string;
  /** The italic word set after "Pioneer". */
  word: string;
  name: Localized;
  manner: Localized;
  lede: Localized;
}

export const PARTS: PartMeta[] = [
  {
    id: "wiki",
    href: "/",
    theme: "biology",
    numeral: "I",
    word: "Wiki",
    name: { zh: "博物", en: "Wiki" },
    manner: { zh: "博物图谱", en: "Natural history" },
    lede: {
      zh: "一部按尺度、角色与关系编目的计算机科学博物志。",
      en: "A natural history of computer science, catalogued by scale, role and relation.",
    },
  },
  {
    id: "links",
    href: "/links",
    theme: "geography",
    numeral: "II",
    word: "Links",
    name: { zh: "友链", en: "Links" },
    manner: { zh: "地理图志", en: "Geography" },
    lede: {
      zh: "近邻的岛屿与港口：与我们互通航线的站点。",
      en: "Neighbouring islands and harbours: the sites we keep a sea route to.",
    },
  },
  {
    id: "members",
    href: "/members",
    theme: "art",
    numeral: "III",
    word: "Members",
    name: { zh: "成员", en: "Members" },
    manner: { zh: "古典画境", en: "Fine art" },
    lede: {
      zh: "浮雕上的群像：写作、绘图、审校与排版这本书的人。",
      en: "The figures in the frieze: the people who write, draw, check and set this book.",
    },
  },
  {
    id: "forum",
    href: "/forum",
    theme: "blueprint",
    numeral: "IV",
    word: "Forum",
    name: { zh: "交流", en: "Forum" },
    manner: { zh: "工程蓝图", en: "Blueprint" },
    lede: {
      zh: "一台交换消息的机器：提问、分享与讨论。",
      en: "A machine for exchanging messages: questions, findings and discussion.",
    },
  },
];

export function partForPath(pathname: string): PartMeta | undefined {
  return PARTS.find((p) => p.href === pathname);
}
