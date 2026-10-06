import type { BioRole, BorderId, DomainId, InkId, Localized, RelationKind, ReviewState, Scale } from "./types";

/**
 * Controlled vocabularies with their bilingual labels. UI code reads labels
 * from here so that a term is spelled the same everywhere.
 */

export const SCALES: Record<Scale, Localized> = {
  macro: { zh: "宏观", en: "Macro" },
  micro: { zh: "微观", en: "Micro" },
};

export const ROLES: Record<BioRole, Localized> = {
  host: { zh: "宿主", en: "Host" },
  symbiont: { zh: "共生体", en: "Symbiont" },
  decomposer: { zh: "分解者", en: "Decomposer" },
  observer: { zh: "观察者", en: "Observer" },
};

export const DOMAINS: Record<DomainId, Localized> = {
  algorithms: { zh: "算法与数据结构", en: "Algorithms" },
  theory: { zh: "计算理论", en: "Theory" },
  languages: { zh: "语言与编译", en: "Languages" },
  systems: { zh: "操作系统", en: "Systems" },
  architecture: { zh: "体系结构", en: "Architecture" },
  networking: { zh: "网络", en: "Networking" },
  distributed: { zh: "分布式", en: "Distributed" },
  databases: { zh: "数据库", en: "Databases" },
  ml: { zh: "机器学习", en: "Machine learning" },
  security: { zh: "安全", en: "Security" },
};

/** One-line description of each phylum, shown on its plate page. */
export const DOMAIN_NOTES: Record<DomainId, Localized> = {
  algorithms: {
    zh: "解决问题的步骤，以及为之服务的数据形态。",
    en: "Step-by-step procedures, and the shapes data takes to serve them.",
  },
  theory: { zh: "什么可以被计算，又要付出多少代价。", en: "What can be computed, and at what cost." },
  languages: { zh: "程序如何被书写、理解与翻译。", en: "How programs are written, understood and translated." },
  systems: { zh: "让许多程序共享一台机器的底层软件。", en: "The software that lets many programs share one machine." },
  architecture: { zh: "处理器与存储器的组织方式。", en: "How processors and memory are organised." },
  networking: { zh: "数据如何穿过不可靠的链路抵达彼端。", en: "How data crosses unreliable links to the other side." },
  distributed: {
    zh: "许多机器如何在故障与延迟之中达成一致。",
    en: "How many machines agree despite failures and delay.",
  },
  databases: { zh: "数据如何被长久保存、组织与查询。", en: "How data is kept, organised and queried." },
  ml: { zh: "从数据中学习规律的方法。", en: "Methods that learn regularities from data." },
  security: {
    zh: "在对手存在时保护信息与系统。",
    en: "Protecting information and systems when adversaries are present.",
  },
};

/**
 * Emblem organism of each phylum (vignette names, request R5). Small, gentle
 * creatures only — readers should feel welcomed, never startled — with a bias
 * towards birds and water life.
 */
/**
 * Each phylum's emblem creature, and why it stands for the phylum — the
 * picture has to say something true about the field, not just decorate it.
 */
export const DOMAIN_EMBLEMS: Record<DomainId, { vignette: string; organism: Localized; why: Localized }> = {
  algorithms: {
    vignette: "weaver-bird",
    organism: { zh: "织布鸟", en: "Weaver bird" },
    why: {
      zh: "织布鸟按固定的步骤一针一线编出巢：先打结，再绕圈，再收口——一个可以重复执行的过程。",
      en: "A weaver builds its nest by fixed steps — knot, loop, close — a procedure it can run again and again.",
    },
  },
  theory: {
    vignette: "nautilus-section",
    organism: { zh: "鹦鹉螺剖面", en: "Nautilus, sectioned" },
    why: {
      zh: "每一个新腔室都按同一比例放大，壳上写着一条对数螺线：生长本身就是一条定理。",
      en: "Every new chamber grows by the same ratio, tracing a logarithmic spiral: the growth itself is a theorem.",
    },
  },
  languages: {
    vignette: "songbird",
    organism: { zh: "鸣禽", en: "Songbird" },
    why: {
      zh: "鸣禽的歌有音节、乐句与句法，幼鸟要先听、再学、再练才能唱准——语言也是这样被习得与解析的。",
      en: "Birdsong has syllables, phrases and syntax, and a fledgling must listen, learn and practise to sing it right — as languages are learned and parsed.",
    },
  },
  systems: {
    vignette: "anemone-clownfish",
    organism: { zh: "海葵与小丑鱼", en: "Anemone & clownfish" },
    why: {
      zh: "海葵提供庇护，小丑鱼在其中安心生活：宿主与房客，正如操作系统与它承载的程序。",
      en: "The anemone shelters, the clownfish lives safely within: host and tenant, like an operating system and the programs it carries.",
    },
  },
  architecture: {
    vignette: "swallow-nest",
    organism: { zh: "燕巢", en: "Swallow at its nest" },
    why: {
      zh: "燕子一口一口衔泥，按受力与空间筑出结构；体系结构也是把有限的材料排成能承重的形状。",
      en: "A swallow lays mud pellet by pellet into a structure shaped by load and space — as architecture arranges scarce material into something that bears weight.",
    },
  },
  networking: {
    vignette: "homing-pigeon",
    organism: { zh: "信鸽", en: "Homing pigeon" },
    why: {
      zh: "信鸽带着一小筒信息，穿过陌生的地形找到回家的路：寻路与投递，正是网络要做的事。",
      en: "A pigeon carries a small capsule across unknown country and finds its way home: routing and delivery, which is what a network does.",
    },
  },
  distributed: {
    vignette: "fish-school",
    organism: { zh: "小鱼群", en: "School of small fish" },
    why: {
      zh: "没有领队，每条鱼只看身边几条，整群却能一起转向：分布式系统靠局部规则达成整体一致。",
      en: "No leader; each fish watches only its neighbours, yet the school turns as one — distributed systems reach agreement through local rules.",
    },
  },
  databases: {
    vignette: "jay-acorn",
    organism: { zh: "松鸦与橡实", en: "Jay with an acorn" },
    why: {
      zh: "一只松鸦秋天能藏下几千颗橡实，冬天还能记得大多数藏在哪里：存储、索引与检索。",
      en: "A jay caches thousands of acorns in autumn and finds most of them again in winter: storage, indexing and retrieval.",
    },
  },
  ml: {
    vignette: "little-owl",
    organism: { zh: "纵纹腹小鸮", en: "Little owl" },
    why: {
      zh: "小鸮在暗处从零星的声响里判断猎物的位置，并随经验越听越准：从稀疏信号中学习。",
      en: "In the dark a little owl places its prey from faint, scattered sounds, and hears more accurately with experience: learning from sparse signals.",
    },
  },
  security: {
    vignette: "turtle-hatchling",
    organism: { zh: "海龟幼体", en: "Sea-turtle hatchling" },
    why: {
      zh: "刚破壳的小海龟带着一层硬壳奔向大海，在一路的威胁中守住自己：防护、信任与生存。",
      en: "A hatchling runs for the sea in its small hard shell, guarding itself through every threat on the way: protection, trust and survival.",
    },
  },
};

export interface ReviewStateMeta {
  label: Localized;
  /** The biological metaphor; always shown next to, never instead of, the label. */
  form: Localized;
}

export const REVIEW_STATES: Record<ReviewState, ReviewStateMeta> = {
  draft: {
    label: { zh: "编辑中", en: "Draft" },
    form: { zh: "孢子", en: "Spore" },
  },
  in_review: {
    label: { zh: "待审核", en: "In review" },
    form: { zh: "枝节", en: "Branching" },
  },
  published: {
    label: { zh: "已发布", en: "Published" },
    form: { zh: "标本", en: "Specimen" },
  },
};

export interface RelationKindMeta {
  label: Localized;
  /** Whether the edge reads in both directions (drawn without an arrowhead). */
  symmetric: boolean;
}

export const RELATION_KINDS: Record<RelationKind, RelationKindMeta> = {
  symbiosis: { label: { zh: "共生", en: "Symbiosis" }, symmetric: true },
  source: { label: { zh: "来源", en: "Source" }, symmetric: false },
  taxonomy: { label: { zh: "分类", en: "Taxonomy" }, symmetric: false },
  contrast: { label: { zh: "对照", en: "Contrast" }, symmetric: true },
  dependency: { label: { zh: "依赖", en: "Dependency" }, symmetric: false },
  dispute: { label: { zh: "争议", en: "Dispute" }, symmetric: true },
};

export const SCALE_IDS = Object.keys(SCALES) as Scale[];
export const ROLE_IDS = Object.keys(ROLES) as BioRole[];
export const DOMAIN_IDS = Object.keys(DOMAINS) as DomainId[];
export const REVIEW_STATE_IDS = Object.keys(REVIEW_STATES) as ReviewState[];
export const RELATION_KIND_IDS = Object.keys(RELATION_KINDS) as RelationKind[];

// ── Bookplates (ex libris) ──────────────────────────────────────────────────

/**
 * 19th-century printing inks a member can print their bookplate and page in.
 * `hex` is text-safe on paper (≥ 4.5:1) so the ink can also set type.
 */
export const INKS: Record<InkId, { name: Localized; hex: string }> = {
  prussian: { name: { zh: "普鲁士蓝", en: "Prussian blue" }, hex: "#1f4e86" },
  madder: { name: { zh: "茜草红", en: "Madder" }, hex: "#8c2f4c" },
  sepia: { name: { zh: "乌贼棕", en: "Sepia" }, hex: "#6b4426" },
  verdigris: { name: { zh: "铜绿", en: "Verdigris" }, hex: "#22605a" },
  vermilion: { name: { zh: "朱砂", en: "Vermilion" }, hex: "#9b3f29" },
  violet: { name: { zh: "铁胆紫", en: "Iron-gall violet" }, hex: "#4e3569" },
  lampblack: { name: { zh: "灯黑", en: "Lamp black" }, hex: "#24221e" },
  ochre: { name: { zh: "赭金", en: "Ochre gold" }, hex: "#6e5829" },
};

/** Bookplate borders; `frame` is the engraved frame in public/vignettes. */
export const BORDERS: Record<BorderId, { name: Localized; frame: string }> = {
  vine: { name: { zh: "藤蔓", en: "Vine" }, frame: "frame-vine" },
  meander: { name: { zh: "希腊回纹", en: "Greek key" }, frame: "frame-meander" },
  rope: { name: { zh: "绳结", en: "Rope" }, frame: "frame-rope" },
  fleuron: { name: { zh: "双线小花", en: "Fleurons" }, frame: "frame-fleuron" },
};

/** The emblem library a member picks from (public/vignettes/ex-*, black-ink engravings tinted with their ink). */
export const EMBLEMS: Array<{ id: string; name: Localized }> = [
  { id: "ex-quill", name: { zh: "羽毛笔", en: "Quill" } },
  { id: "ex-book", name: { zh: "翻开的书", en: "Open book" } },
  { id: "ex-lamp", name: { zh: "油灯", en: "Oil lamp" } },
  { id: "ex-compass", name: { zh: "分规", en: "Dividers" } },
  { id: "ex-astrolabe", name: { zh: "星盘", en: "Astrolabe" } },
  { id: "ex-telescope", name: { zh: "望远镜", en: "Telescope" } },
  { id: "ex-hourglass", name: { zh: "沙漏", en: "Hourglass" } },
  { id: "ex-key", name: { zh: "钥匙", en: "Key" } },
  { id: "ex-lyre", name: { zh: "里拉琴", en: "Lyre" } },
  { id: "ex-palette", name: { zh: "调色板", en: "Palette" } },
  { id: "ex-owl", name: { zh: "书上的小鸮", en: "Owl on books" } },
  { id: "ex-swallow", name: { zh: "飞燕", en: "Swallow" } },
  { id: "ex-fern", name: { zh: "蕨", en: "Fern" } },
  { id: "ex-oak", name: { zh: "橡枝", en: "Oak sprig" } },
  { id: "ex-anchor", name: { zh: "锚", en: "Anchor" } },
  { id: "ex-ship", name: { zh: "帆船", en: "Ship" } },
  { id: "ex-balloon", name: { zh: "热气球", en: "Balloon" } },
  { id: "ex-gear", name: { zh: "齿轮", en: "Gears" } },
  { id: "ex-lighthouse", name: { zh: "灯塔", en: "Lighthouse" } },
  { id: "ex-armillary", name: { zh: "浑天仪", en: "Armillary sphere" } },
  { id: "ex-rose", name: { zh: "野蔷薇", en: "Wild rose" } },
  { id: "ex-nautilus", name: { zh: "鹦鹉螺", en: "Nautilus" } },
  { id: "ex-mountain", name: { zh: "山与星", en: "Peak and star" } },
  { id: "ex-watch", name: { zh: "怀表", en: "Pocket watch" } },
];
