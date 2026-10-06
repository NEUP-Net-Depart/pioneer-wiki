import type { EntrySummary, Relation, ReviewState } from "@/lib/model/types";

/**
 * Mock entry fixtures (content authored by Claude Code; read by the mock
 * adapters in src/lib/services/mock, owned by Codex).
 *
 * Bodies live in `src/mock/bodies/<slug>.md`. One file holds the whole growth
 * history of an entry using block markers on their own lines:
 *
 *   <!-- @since 3 -->  …lines that exist from revision 3 onwards…  <!-- @end -->
 *   <!-- @until 2 -->  …lines that exist up to revision 2 only…     <!-- @end -->
 *   <!-- @in 2-3 -->   …lines that exist in revisions 2 and 3 only… <!-- @end -->
 *
 * The body of revision n keeps `@since k` blocks with k ≤ n, `@until k` blocks
 * with n ≤ k, and `@in a-b` blocks with a ≤ n ≤ b. Each marker sits on its own
 * line; markers never nest. Unmarked lines exist in every revision.
 */

export interface RevisionFixture {
  number: number;
  authorId: string;
  createdAt: string;
  note: string;
  state: ReviewState;
}

export interface EntryFixture extends Omit<EntrySummary, "revision"> {
  /** Reader-visible revision number (the latest published one, if any). */
  revision: number;
  /** Oldest first. The last one is the newest, possibly unpublished. */
  revisions: RevisionFixture[];
}

const rev = (
  number: number,
  authorId: string,
  createdAt: string,
  state: ReviewState,
  note: string,
): RevisionFixture => ({ number, authorId, createdAt, state, note });

export const entries: EntryFixture[] = [
  {
    id: "PW-0001",
    slug: "gossip-protocol",
    heroAssetId: "plate-gossip-protocol",
    title: { zh: "流言协议", en: "Gossip protocol" },
    analogue: {
      name: { zh: "菌丝网络", en: "Mycelial network" },
      note: {
        zh: "养分沿菌丝扩散：每个节点只与少数邻居交换，消息却能在对数轮次内覆盖整片森林。",
        en: "Like nutrients in hyphae: each node talks to a few neighbours, yet news reaches the whole forest in logarithmic rounds.",
      },
    },
    summary: {
      zh: "节点周期性地随机挑选同伴交换状态，使信息像流行病一样在集群中扩散；不需要中心协调者，对节点故障天然稳健。",
      en: "Nodes periodically exchange state with randomly chosen peers, so information spreads through a cluster like an epidemic — no coordinator, and naturally tolerant of failures.",
    },
    domain: "distributed",
    scale: "macro",
    role: "symbiont",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-demers87"],
    tagIds: ["replication", "epidemic", "probabilistic"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-06-12T09:20:00+08:00",
    updatedAt: "2026-09-30T21:05:00+08:00",
    featured: true,
    revision: 4,
    revisions: [
      rev(1, "a-qingkong", "2026-06-12T09:20:00+08:00", "published", "初稿：定义与基本推拉模型"),
      rev(
        2,
        "a-qingkong",
        "2026-07-03T16:42:00+08:00",
        "published",
        "Add convergence estimate and the rumor-mongering variant",
      ),
      rev(3, "a-qingkong", "2026-08-19T11:10:00+08:00", "published", "补充反熵与示例代码"),
      rev(4, "a-qingkong", "2026-09-30T21:05:00+08:00", "published", "审校：修正收敛轮次公式，补充对照表与脚注"),
    ],
  },
  {
    id: "PW-0002",
    slug: "raft-consensus",
    heroAssetId: "plate-raft-consensus",
    analogue: {
      name: { zh: "绿头鸭与小鸭", en: "Mallard and ducklings" },
      note: {
        zh: "鸭妈妈在前领路，小鸭一只接一只踩着同一道水痕前进；领头者若走失，队伍会重新认一位。Raft 的跟随者也按领导者的日志逐条复制，领导者失联就重新选举。",
        en: "The mother leads and every duckling keeps to the same wake, one after another; lose her and the line settles on a new leader. Raft followers copy the leader's log entry by entry, and elect a new leader when it goes quiet.",
      },
    },
    title: { zh: "Raft 共识算法", en: "Raft consensus" },
    summary: {
      zh: "以“可理解性”为首要目标设计的共识算法：通过领导者选举、日志复制与安全性约束，让一组服务器就同一序列的命令达成一致。",
      en: "A consensus algorithm designed for understandability: leader election, log replication and safety rules keep a group of servers agreeing on one sequence of commands.",
    },
    domain: "distributed",
    scale: "macro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-ongaro14"],
    tagIds: ["consensus", "replication"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-07-08T10:00:00+08:00",
    updatedAt: "2026-09-14T18:30:00+08:00",
    revision: 2,
    revisions: [
      rev(1, "a-qingkong", "2026-07-08T10:00:00+08:00", "published", "Initial entry: roles and terms"),
      rev(2, "a-qingkong", "2026-09-14T18:30:00+08:00", "published", "补充日志匹配性质与成员变更"),
    ],
  },
  {
    id: "PW-0003",
    slug: "paxos",
    heroAssetId: "plate-paxos",
    analogue: {
      name: { zh: "反嘴鹬群", en: "A flock of avocets" },
      note: {
        zh: "没有哪只鸟下命令；只要多数已朝向同一方向，迟疑的几只也会转身跟上——决定属于多数，而不属于某一个体。Paxos 也只需多数派接受，同一个值便被选定，少数节点失联也不改变结果。",
        en: "No bird gives the order; once most face one way, the hesitant few turn to follow — the decision belongs to a majority, not to anyone. Paxos likewise needs only a majority to accept, and a value is chosen even if a few nodes are lost.",
      },
    },
    title: { zh: "Paxos 共识算法", en: "Paxos" },
    summary: {
      zh: "Lamport 提出的经典共识协议，以提议者、接受者与学习者三种角色，在异步网络和节点崩溃下保证安全性。",
      en: "Lamport's classic consensus protocol: proposers, acceptors and learners preserve safety in an asynchronous network with crashing nodes.",
    },
    domain: "distributed",
    scale: "macro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-lamport98"],
    tagIds: ["consensus", "classic"],
    bodyLanguages: ["en"],
    createdAt: "2026-07-21T14:15:00+08:00",
    updatedAt: "2026-07-21T14:15:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-07-21T14:15:00+08:00", "published", "Initial entry")],
  },
  {
    id: "PW-0004",
    slug: "garbage-collection",
    heroAssetId: "plate-garbage-collection",
    title: { zh: "垃圾回收", en: "Garbage collection" },
    analogue: {
      name: { zh: "腐生真菌", en: "Saprotrophic fungi" },
      note: {
        zh: "分解者把不再被生态引用的物质拆解归还土壤；回收器把不可达的对象归还堆。",
        en: "Decomposers return matter no longer referenced by the ecosystem to the soil; a collector returns unreachable objects to the heap.",
      },
    },
    summary: {
      zh: "运行时自动识别不再可达的对象并回收其内存。从标记—清除到分代与并发回收，核心问题始终是：哪些对象仍然活着。",
      en: "The runtime finds objects that are no longer reachable and reclaims their memory. From mark–sweep to generational and concurrent collectors, the question is always: what is still alive?",
    },
    domain: "languages",
    scale: "micro",
    role: "decomposer",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-mccarthy60", "s-jones11"],
    tagIds: ["memory", "runtime"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-06-20T08:45:00+08:00",
    updatedAt: "2026-09-26T10:12:00+08:00",
    featured: true,
    revision: 3,
    revisions: [
      rev(1, "a-qingkong", "2026-06-20T08:45:00+08:00", "published", "初稿：可达性与标记—清除"),
      rev(2, "a-qingkong", "2026-08-02T20:31:00+08:00", "published", "增加分代假说与三色标记"),
      rev(3, "a-qingkong", "2026-09-26T10:12:00+08:00", "published", "Add comparison table and pause-time formula"),
    ],
  },
  {
    id: "PW-0005",
    slug: "compiler",
    heroAssetId: "plate-compiler",
    analogue: {
      name: { zh: "树蛙的变态", en: "A tree frog's metamorphosis" },
      note: {
        zh: "卵、蝌蚪、长腿的蝌蚪、幼蛙、成蛙：同一个体经过几个阶段，换成适合另一个世界的形态，而本质不变。编译器也让同一个程序经过词法、语法、中间表示与代码生成，从源语言变成机器能运行的形态。",
        en: "Spawn, tadpole, legged tadpole, froglet, frog: one creature passes through stages into a form fit for another world, its identity intact. A compiler carries one program through lexing, parsing, IR and code generation into a form a machine can run.",
      },
    },
    title: { zh: "编译器", en: "Compiler" },
    summary: {
      zh: "把一种语言的程序翻译成另一种语言（通常是机器码）的程序：词法与语法分析、语义分析、中间表示、优化与代码生成。",
      en: "Translates a program from one language into another, usually machine code: lexing and parsing, semantic analysis, intermediate representation, optimisation and code generation.",
    },
    domain: "languages",
    scale: "macro",
    role: "decomposer",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-aho06"],
    tagIds: ["parsing"],
    bodyLanguages: ["zh"],
    createdAt: "2026-06-28T13:00:00+08:00",
    updatedAt: "2026-08-30T09:40:00+08:00",
    revision: 2,
    revisions: [
      rev(1, "a-qingkong", "2026-06-28T13:00:00+08:00", "published", "初稿"),
      rev(2, "a-qingkong", "2026-08-30T09:40:00+08:00", "published", "补充中间表示一节"),
    ],
  },
  {
    id: "PW-0006",
    slug: "parser",
    heroAssetId: "plate-parser",
    analogue: {
      name: { zh: "核糖体读取信使 RNA", en: "A ribosome reading messenger RNA" },
      note: {
        zh: "核糖体沿一条线性的 RNA 逐个读取三联密码，按规则把氨基酸接成链，链再折叠成有层次的结构。语法分析器同样逐个读入线性的记号，按文法把它们组装成一棵语法树。",
        en: "A ribosome reads a linear RNA strand one codon at a time and, by fixed rules, joins amino acids into a chain that folds into a structure. A parser reads a linear stream of tokens and, by its grammar, assembles them into a tree.",
      },
    },
    title: { zh: "语法分析器", en: "Parser" },
    summary: {
      zh: "把词法单元流组织成语法树的组件。递归下降、LL 与 LR 是三种主要的构造方法。",
      en: "Turns a stream of tokens into a syntax tree. Recursive descent, LL and LR are the three main construction methods.",
    },
    domain: "languages",
    scale: "micro",
    role: "decomposer",
    status: "in_review",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-aho06"],
    tagIds: ["parsing", "recursion"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-08-05T15:20:00+08:00",
    updatedAt: "2026-10-01T22:18:00+08:00",
    revision: 1,
    revisions: [
      rev(1, "a-qingkong", "2026-08-05T15:20:00+08:00", "published", "Initial entry"),
      rev(2, "a-qingkong", "2026-10-01T22:18:00+08:00", "in_review", "补充 LR 分析表示例，待审核"),
    ],
  },
  {
    id: "PW-0007",
    slug: "os-kernel",
    heroAssetId: "plate-os-kernel",
    title: { zh: "操作系统内核", en: "Operating-system kernel" },
    analogue: {
      name: { zh: "珊瑚礁", en: "Coral reef" },
      note: {
        zh: "珊瑚为成千上万的生物提供栖所与秩序；内核为进程提供地址空间、调度与隔离。",
        en: "Coral gives shelter and order to thousands of organisms; the kernel gives processes address spaces, scheduling and isolation.",
      },
    },
    summary: {
      zh: "运行在最高特权级的核心程序，管理处理器、内存与设备，并以系统调用的形式向进程提供抽象。",
      en: "The core program running at the highest privilege level: it manages processors, memory and devices, and offers them to processes as system-call abstractions.",
    },
    domain: "systems",
    scale: "macro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-ostep18"],
    tagIds: ["concurrency", "memory"],
    bodyLanguages: ["zh"],
    createdAt: "2026-07-15T19:00:00+08:00",
    updatedAt: "2026-07-15T19:00:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-07-15T19:00:00+08:00", "published", "初稿")],
  },
  {
    id: "PW-0008",
    slug: "memory-hierarchy",
    heroAssetId: "plate-memory-hierarchy",
    analogue: {
      name: { zh: "分层标本柜", en: "A tiered specimen cabinet" },
      note: {
        zh: "最常用的标本放在手边的小抽屉里，取得最快；不常用的收进下层的大抽屉，装得多却要弯腰去找。存储层级也是这样：越靠近处理器越小越快，越远越大越慢。",
        en: "The specimens in daily use live in the small drawers at hand; the rest go into the big drawers below — roomier, but you have to stoop. Memory is tiered the same way: smaller and faster near the processor, larger and slower further out.",
      },
    },
    title: { zh: "存储层级", en: "Memory hierarchy" },
    summary: {
      zh: "寄存器、各级缓存、主存与外存组成的金字塔：越靠近处理器越快、越小、越贵。局部性原理让这座金字塔得以成立。",
      en: "Registers, caches, main memory and storage form a pyramid: the closer to the processor, the faster, smaller and dearer. Locality is what makes the pyramid work.",
    },
    domain: "architecture",
    scale: "macro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-hennessy17", "s-drepper07"],
    tagIds: ["memory"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-09-21T15:05:00+08:00",
    updatedAt: "2026-09-21T15:05:00+08:00",
    featured: true,
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-09-21T15:05:00+08:00", "published", "Initial entry with latency table")],
  },
  {
    id: "PW-0009",
    slug: "cache-line",
    heroAssetId: "plate-cache-line",
    analogue: {
      name: { zh: "蜂巢", en: "Honeycomb" },
      note: {
        zh: "蜜蜂一次封存一整格，从不只装半格；格子大小完全一致，排列紧密。处理器同样以整条缓存行（通常 64 字节）为单位搬运数据：读一个字节，它的邻居也一同被带来。",
        en: "Bees fill and cap a whole cell at a time, never half of one, and every cell is the same size. A processor moves memory a whole cache line (usually 64 bytes) at a time: read one byte and its neighbours come along.",
      },
    },
    title: { zh: "缓存行", en: "Cache line" },
    summary: {
      zh: "缓存与主存之间传输的最小单位，通常为 64 字节。它解释了顺序访问为何快，也解释了伪共享为何慢。",
      en: "The unit moved between cache and memory, usually 64 bytes. It explains why sequential access is fast — and why false sharing is slow.",
    },
    domain: "architecture",
    scale: "micro",
    role: "symbiont",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-drepper07"],
    tagIds: ["memory", "concurrency"],
    bodyLanguages: ["en"],
    createdAt: "2026-07-30T17:45:00+08:00",
    updatedAt: "2026-07-30T17:45:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-07-30T17:45:00+08:00", "published", "Initial entry")],
  },
  {
    id: "PW-0010",
    slug: "bloom-filter",
    heroAssetId: "plate-bloom-filter",
    analogue: {
      name: { zh: "柱头辨认花粉", en: "A stigma recognising pollen" },
      note: {
        zh: "柱头不记住每一粒花粉，只辨认表面的形状与蛋白：同种花粉从不被拒，形状相近的异种偶尔会被误认。布隆过滤器也只保存几个哈希位：不在集合里的元素可能被误判为在，在集合里的却从不会被漏掉。",
        en: "A stigma remembers no single grain; it only recognises surface shape and proteins: its own species is never refused, a look-alike is now and then let in. A Bloom filter keeps only a few hash bits: it may say yes to a stranger, but never no to a member.",
      },
    },
    title: { zh: "布隆过滤器", en: "Bloom filter" },
    summary: {
      zh: "用一个位数组和若干哈希函数回答“某元素是否在集合中”：可能误报，绝不漏报，空间极省。",
      en: "Answers “is this element in the set?” with a bit array and a few hash functions: false positives are possible, false negatives never, and it is tiny.",
    },
    domain: "algorithms",
    scale: "micro",
    role: "observer",
    status: "draft",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-bloom70"],
    tagIds: ["probabilistic"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-10-02T20:10:00+08:00",
    updatedAt: "2026-10-02T20:10:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-10-02T20:10:00+08:00", "draft", "草稿：误报率公式待核对")],
  },
  {
    id: "PW-0011",
    slug: "perceptron",
    heroAssetId: "plate-perceptron",
    title: { zh: "感知机", en: "Perceptron" },
    analogue: {
      name: { zh: "神经元", en: "Neuron" },
      note: {
        zh: "树突汇集信号、胞体整合、轴突在越过阈值时放电——感知机是这一过程最简的数学标本。",
        en: "Dendrites gather signals, the soma integrates them, the axon fires past a threshold — the perceptron is the barest mathematical specimen of that process.",
      },
    },
    summary: {
      zh: "最早的可学习线性分类器：对输入加权求和后取阈值。它只能分开线性可分的数据，这一局限曾让神经网络研究沉寂多年。",
      en: "The first learnable linear classifier: a weighted sum followed by a threshold. It can only separate linearly separable data — a limit that once quieted neural-network research for years.",
    },
    domain: "ml",
    scale: "micro",
    role: "observer",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-rosenblatt58", "s-minsky69"],
    tagIds: ["learning", "classic"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-06-16T10:05:00+08:00",
    updatedAt: "2026-09-28T09:50:00+08:00",
    featured: true,
    revision: 3,
    revisions: [
      rev(1, "a-qingkong", "2026-06-16T10:05:00+08:00", "published", "Initial entry: model and update rule"),
      rev(2, "a-qingkong", "2026-07-25T21:15:00+08:00", "published", "补充收敛定理"),
      rev(3, "a-qingkong", "2026-09-28T09:50:00+08:00", "published", "补充 XOR 反例与历史争议"),
    ],
  },
  {
    id: "PW-0012",
    slug: "backpropagation",
    heroAssetId: "plate-backpropagation",
    analogue: {
      name: { zh: "叶脉", en: "Leaf venation" },
      note: {
        zh: "叶片每一处细脉的养分都沿脉络层层汇回主脉与叶柄，越细的脉承担的份额越小。反向传播也把输出端的误差沿网络逐层送回，每一个权重按自己的贡献分担一份。",
        en: "From every fine vein of a leaf, sap flows back through ever-larger veins to the midrib and stalk, each vein carrying its share. Backpropagation sends the output's error back through the network layer by layer, and every weight takes its share of the blame.",
      },
    },
    title: { zh: "反向传播", en: "Backpropagation" },
    summary: {
      zh: "用链式法则从输出层向输入层逐层计算误差梯度，使多层网络可以被高效训练。",
      en: "Applies the chain rule from the output layer back towards the input, layer by layer, so that multi-layer networks can be trained efficiently.",
    },
    domain: "ml",
    scale: "micro",
    role: "decomposer",
    status: "in_review",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-rumelhart86"],
    tagIds: ["learning"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-08-11T12:00:00+08:00",
    updatedAt: "2026-10-02T16:25:00+08:00",
    revision: 1,
    revisions: [
      rev(1, "a-qingkong", "2026-08-11T12:00:00+08:00", "published", "初稿"),
      rev(2, "a-qingkong", "2026-10-02T16:25:00+08:00", "in_review", "增加计算图示例"),
    ],
  },
  {
    id: "PW-0013",
    slug: "l-system",
    heroAssetId: "plate-l-system",
    title: { zh: "L 系统", en: "L-system" },
    analogue: {
      name: { zh: "植物形态发生", en: "Plant morphogenesis" },
      note: {
        zh: "Lindenmayer 最初正是为描述藻类与植物的生长而发明了这套并行重写文法。",
        en: "Lindenmayer invented these parallel rewriting grammars precisely to describe how algae and plants grow.",
      },
    },
    summary: {
      zh: "一种并行字符串重写系统：每一代同时替换所有符号，再用海龟绘图解释结果，便能长出蕨叶与树枝。",
      en: "A parallel string-rewriting system: every symbol is replaced at once each generation, and a turtle interprets the result — ferns and branches grow out of it.",
    },
    domain: "theory",
    scale: "micro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-prusinkiewicz90"],
    tagIds: ["recursion", "tree"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-08-24T08:00:00+08:00",
    updatedAt: "2026-08-24T08:00:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-08-24T08:00:00+08:00", "published", "初稿")],
  },
  {
    id: "PW-0014",
    slug: "ant-colony-optimization",
    heroAssetId: "plate-ant-colony-optimization",
    title: { zh: "蚁群优化", en: "Ant colony optimization" },
    analogue: {
      name: { zh: "兔子踩出的小径", en: "Rabbit runs through a meadow" },
      note: {
        zh: "算法取自蚂蚁的信息素，但同样的「留痕协作」也写在草地上：每走过一次，草就被多踩倒一点；没人走的小径会重新长满（蒸发）；往返最快的那条最常被走，于是最清楚。蚁群优化让人工蚂蚁照此留下与蒸发信息素，逐渐收敛到近似最短路。",
        en: "The algorithm borrows from ant pheromone, but the same trace-by-use is written in any meadow: each passage flattens the grass a little more, unused runs grow back over (evaporation), and the run quickest to travel is used most and becomes the clearest. ACO lets artificial ants lay and evaporate pheromone the same way until near-shortest routes emerge.",
      },
    },
    summary: {
      zh: "模拟蚂蚁信息素路径的元启发式算法，用于旅行商等组合优化问题。",
      en: "A metaheuristic that imitates pheromone trails, used for combinatorial problems such as the travelling salesman.",
    },
    domain: "algorithms",
    scale: "macro",
    role: "observer",
    status: "draft",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-dorigo96"],
    tagIds: ["optimization", "probabilistic"],
    bodyLanguages: ["en"],
    createdAt: "2026-09-29T13:40:00+08:00",
    updatedAt: "2026-10-01T10:05:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-10-01T10:05:00+08:00", "draft", "Draft: evaporation section incomplete")],
  },
  {
    id: "PW-0015",
    slug: "b-tree",
    heroAssetId: "plate-b-tree",
    analogue: {
      name: { zh: "图书馆卡片目录", en: "A library card catalogue" },
      note: {
        zh: "先看柜面上的标签找到抽屉，再按导卡找到那一组，最后翻到那一张卡片：无论找哪一张，都只需同样几步。B 树也是宽而矮、完全平衡的索引——每个节点容纳许多键，每一片叶子离根一样远，一次磁盘读取就能跨过一大段。",
        en: "Read the cabinet labels to choose a drawer, the guide cards to choose a section, then the card itself: any card is the same few steps away. A B-tree is just such a wide, shallow, perfectly balanced index — many keys per node, every leaf the same distance from the root, one disk read spanning a large range.",
      },
    },
    title: { zh: "B 树", en: "B-tree" },
    summary: {
      zh: "为磁盘与页式存储设计的自平衡多路搜索树：节点很宽、树很矮，一次查找只需读取寥寥几页。",
      en: "A self-balancing multiway search tree built for disks and paged storage: wide nodes, shallow trees, and only a few page reads per lookup.",
    },
    domain: "databases",
    scale: "micro",
    role: "host",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-bayer72"],
    tagIds: ["tree"],
    bodyLanguages: ["zh", "en"],
    createdAt: "2026-09-08T14:20:00+08:00",
    updatedAt: "2026-09-08T14:20:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-09-08T14:20:00+08:00", "published", "初稿，含分裂过程")],
  },
  {
    id: "PW-0016",
    slug: "tcp-congestion-control",
    heroAssetId: "plate-tcp-congestion-control",
    analogue: {
      name: { zh: "追浪的三趾滨鹬", en: "Sanderlings chasing the waves" },
      note: {
        zh: "浪退时，滨鹬一步一步向前试探，啄食露出的沙地；浪一回来，它们立刻飞快退后，然后再一步步向前。TCP 拥塞控制正是如此：没有丢包时缓慢加大发送窗口（加性增），一旦丢包就把窗口减半（乘性减）。",
        en: "As a wave draws back, sanderlings creep forward a step at a time to feed on the uncovered sand; the moment it returns they dash back, then creep forward again. TCP congestion control does the same: grow the window slowly while nothing is lost (additive increase), halve it as soon as a packet is (multiplicative decrease).",
      },
    },
    title: { zh: "TCP 拥塞控制", en: "TCP congestion control" },
    summary: {
      zh: "发送方依据丢包与时延推断网络拥塞，并以“加性增、乘性减”调节发送窗口，让众多连接公平地共享带宽。",
      en: "Senders infer congestion from loss and delay and adjust their window by additive increase, multiplicative decrease, so many connections share bandwidth fairly.",
    },
    domain: "networking",
    scale: "macro",
    role: "symbiont",
    status: "published",
    authorId: "a-qingkong",
    contributorIds: [],
    sourceIds: ["s-jacobson88"],
    tagIds: [],
    bodyLanguages: ["zh"],
    createdAt: "2026-08-15T16:00:00+08:00",
    updatedAt: "2026-08-15T16:00:00+08:00",
    revision: 1,
    revisions: [rev(1, "a-qingkong", "2026-08-15T16:00:00+08:00", "published", "初稿")],
  },
];

const r = (
  id: string,
  from: string,
  to: string,
  kind: Relation["kind"],
  strength: Relation["strength"],
  note?: Relation["note"],
): Relation => ({ id, from, to, kind, strength, note });

/** Directed relations between entries (by EntryId). */
export const relations: Relation[] = [
  r("rel-01", "PW-0002", "PW-0003", "contrast", 3, {
    zh: "同为多数派共识，Raft 以可理解性为目标重新组织了 Paxos 的思想。",
    en: "Both are majority-quorum consensus; Raft reorganises Paxos's ideas for understandability.",
  }),
  r("rel-02", "PW-0002", "PW-0003", "dispute", 1, {
    zh: "Raft 是否“更简单”仍有争论：许多人认为差异主要在表述。",
    en: "Whether Raft is really simpler is debated; many argue the difference is mostly presentation.",
  }),
  r("rel-03", "PW-0001", "PW-0002", "contrast", 2, {
    zh: "最终一致的流言传播 vs. 强一致的日志复制。",
    en: "Eventually consistent gossip vs strongly consistent log replication.",
  }),
  r("rel-04", "PW-0001", "PW-0015", "symbiosis", 1, {
    zh: "许多存储系统用流言协议传播成员与元数据，用 B 树组织数据页。",
    en: "Many storage systems gossip membership and metadata while B-trees organise their pages.",
  }),
  r("rel-05", "PW-0005", "PW-0006", "taxonomy", 3, {
    zh: "语法分析器是编译器前端的一部分。",
    en: "The parser is part of the compiler front end.",
  }),
  r("rel-06", "PW-0005", "PW-0004", "symbiosis", 2, {
    zh: "编译器输出栈映射与写屏障，回收器才能精确找到根。",
    en: "Compilers emit stack maps and write barriers so the collector can find roots precisely.",
  }),
  r("rel-07", "PW-0004", "PW-0007", "dependency", 2, {
    zh: "回收器依赖内核的虚拟内存与页保护机制。",
    en: "Collectors rely on kernel virtual memory and page protection.",
  }),
  r("rel-08", "PW-0004", "PW-0008", "dependency", 1),
  r("rel-09", "PW-0009", "PW-0008", "taxonomy", 3, {
    zh: "缓存行是存储层级中缓存与主存之间的传输单位。",
    en: "The cache line is the transfer unit between cache and memory in the hierarchy.",
  }),
  r("rel-10", "PW-0007", "PW-0008", "dependency", 2),
  r("rel-11", "PW-0015", "PW-0008", "dependency", 2, {
    zh: "B 树的宽节点正是为页式存储的访问代价而设计。",
    en: "B-tree's wide nodes are shaped by the cost of paged storage access.",
  }),
  r("rel-12", "PW-0012", "PW-0011", "source", 3, {
    zh: "反向传播把感知机的学习推广到多层网络。",
    en: "Backpropagation generalises perceptron learning to multi-layer networks.",
  }),
  r("rel-13", "PW-0011", "PW-0012", "dispute", 2, {
    zh: "《感知机》一书的批评与多层网络能否训练之争。",
    en: "The critique in Perceptrons and the argument over whether multi-layer networks could be trained.",
  }),
  r("rel-14", "PW-0014", "PW-0001", "contrast", 1, {
    zh: "两者都靠局部交互产生全局行为：信息素 vs. 流言。",
    en: "Both get global behaviour from local interaction: pheromone vs rumour.",
  }),
  r("rel-15", "PW-0013", "PW-0006", "contrast", 1, {
    zh: "L 系统并行重写，语法分析按产生式逆向归约。",
    en: "L-systems rewrite in parallel; parsers reduce productions in reverse.",
  }),
  r("rel-16", "PW-0010", "PW-0015", "symbiosis", 2, {
    zh: "LSM 与 B 树存储常用布隆过滤器跳过不含目标键的页。",
    en: "LSM and B-tree stores use Bloom filters to skip pages that cannot contain a key.",
  }),
  r("rel-17", "PW-0016", "PW-0001", "contrast", 1),
  r("rel-18", "PW-0009", "PW-0007", "dependency", 1),
];
