import type { Asset } from "@/lib/model/types";
import plateSizes from "../../public/plates/web/sizes.json";

/*
 * Specimen plates (gpt-image-2, prompts in tools/illustrations.json and
 * public/plates/manifest.json). tools/prepare-plates.mjs cuts the paper ground
 * to alpha, so plates are printed straight onto the page with no box.
 */

const CREDIT = "Pioneer Wiki specimen plate · generated with gpt-image-2";
const LICENSE = "CC BY 4.0";

export const assets: Asset[] = [
  {
    id: "plate-frontispiece",
    src: "/plates/web/frontispiece.webp",
    width: 1536,
    height: 1024,
    alt: {
      zh: "一块漂浮的森林地表剖面：长满苔藓的倒木上停着一只鹪鹩，红伞蘑菇与蕨叶之间爬着一只蜗牛，土中菌丝相连，右端一汪清溪里游着两条小鱼。",
      en: "A floating slab of forest floor: a wren on a mossy log, a snail among red-capped mushrooms and ferns, mycelium threading the soil, and two small fish in a pool of stream water at the right.",
    },
    caption: { zh: "卷首：一座彼此相连的小小群落。", en: "Frontispiece: one small, connected community." },
    credit: "Pioneer Wiki frontispiece plate · generated with gpt-image-2",
    license: LICENSE,
  },
  {
    id: "plate-gossip-protocol",
    src: "/plates/web/gossip-protocol.webp",
    width: 1536,
    height: 1024,
    alt: {
      zh: "铜版画风格的土壤剖面：几朵红伞蘑菇之下，白色菌丝在土中分叉又重新相连，织成一张网。",
      en: "Engraved soil cross-section: beneath a few red-capped mushrooms, white hyphae branch and rejoin into a mesh.",
    },
    caption: { zh: "菌丝网络，流言协议的生物对照。", en: "A mycelial network — the biological analogue of gossip." },
    credit: CREDIT,
    license: LICENSE,
  },
  {
    id: "plate-garbage-collection",
    src: "/plates/web/garbage-collection.webp",
    width: 1536,
    height: 1024,
    alt: {
      zh: "铜版画风格的倒伏朽木：层孔菌与黏菌附着其上，中空的木头碎裂成细小的颗粒散落一地。",
      en: "Engraved fallen log colonised by bracket fungi and slime moulds; the hollow wood crumbles into fine particles.",
    },
    caption: { zh: "腐生真菌把朽木归还土壤。", en: "Saprotrophic fungi return dead wood to the soil." },
    credit: CREDIT,
    license: LICENSE,
  },
  {
    id: "plate-perceptron",
    src: "/plates/web/perceptron.webp",
    width: 1024,
    height: 1536,
    alt: {
      zh: "卡哈尔墨线风格的单个神经元：胞体居中，树突向四周分枝，一条带髓鞘的长轴突向下延伸到末梢。",
      en: "A single neuron in the manner of a Cajal ink drawing: central cell body, branching dendrites, one long myelinated axon running down to its terminals.",
    },
    caption: { zh: "神经元，感知机的生物原型。", en: "The neuron, the perceptron's biological original." },
    credit: CREDIT,
    license: LICENSE,
  },
  {
    id: "plate-memory-hierarchy",
    src: "/plates/web/memory-hierarchy.webp",
    width: 1145,
    height: 1374,
    alt: {
      zh: "剖开的标本柜：上层是许多浅而小的抽屉，下层是少数深而大的抽屉，几只抽屉拉开，露出贝壳、矿石与植物标本。",
      en: "A cut-away specimen cabinet: many small shallow drawers above, a few large deep drawers below; open drawers show shells, minerals and pressed plants.",
    },
    caption: {
      zh: "越靠上越小、越快——存储层级的档案柜隐喻。",
      en: "Smaller and quicker towards the top — the memory hierarchy as a cabinet.",
    },
    credit: CREDIT,
    license: LICENSE,
  },
  ...(
    [
      [
        "raft-consensus",
        "绿头鸭妈妈领着五只小鸭排成一列游过静水。",
        "A mother mallard leads five ducklings in single file across still water.",
        "领头者在前，所有跟随者照同一条航迹前进。",
        "One leader ahead; every follower keeps to the same wake.",
      ],
      [
        "paxos",
        "七只反嘴鹬站在一小片湿泥滩上，多数朝向同一方向，两只正转头加入。",
        "Seven pied avocets on a patch of wet mudflat; most face one way, two turn to join them.",
        "多数一旦朝向一致，群体便有了决定。",
        "Once a majority faces one way, the flock has decided.",
      ],
      [
        "compiler",
        "围绕一片睡莲叶的树蛙变态：卵块、蝌蚪、长出后腿的蝌蚪、幼蛙与成蛙，旁边一朵粉色睡莲。",
        "A tree frog's metamorphosis around one lily pad: spawn, tadpoles, a tadpole with hind legs, a froglet and the adult frog beside a pink water lily.",
        "同一个体，经过几个阶段变成另一种形态。",
        "One creature, carried through stages into another form.",
      ],
      [
        "parser",
        "压制的红色海藻标本：一根主茎层层分出越来越细的枝，基部一枚群青色小螺壳。",
        "A pressed red seaweed: one main stem branching again and again into finer branchlets, a small ultramarine shell at its base.",
        "从一根线性的茎长成一棵有序的树。",
        "From one linear stem, an ordered tree.",
      ],
      [
        "os-kernel",
        "珊瑚礁剖面：一座巨大的珊瑚宿主结构，缝隙里栖息着许多小生物。",
        "A coral reef in section: one great host structure with small creatures living in its crevices.",
        "宿主提供结构，房客各自生活。",
        "The host provides the structure; the tenants live their own lives.",
      ],
      [
        "l-system",
        "一枝正在展开的蕨叶与两枝小蕨叶，展示自相似的递归分枝。",
        "An unrolling fern frond with two smaller fronds, showing self-similar recursive branching.",
        "同一条规则，一次次重写出整株植物。",
        "One rule, rewritten again and again into a whole plant.",
      ],
      [
        "ant-colony-optimization",
        "一小片草甸：左边是兔子洞口，右边是三叶草，几条蜿蜒小径之间最短的那条被踩得最宽，两只野兔走在上面。",
        "A small patch of meadow: a rabbit burrow at the left, clover at the right; of the winding runs between them the shortest is worn widest, with two wild rabbits on it.",
        "走的次数越多，路就越清楚。",
        "The more a path is travelled, the clearer it becomes.",
      ],
      [
        "b-tree",
        "压制的小枝标本，分枝层级完全平衡，只有最外一层长着叶子。",
        "A pressed twig with perfectly balanced branching levels; leaves grow only on the outermost tier.",
        "每一片叶子离主干都一样远。",
        "Every leaf is the same distance from the stem.",
      ],
      [
        "cache-line",
        "一块圆形蜂巢残片：整齐的六边形蜡室，有的封着蜡盖，有的盛着琥珀色蜂蜜。",
        "A rounded fragment of honeycomb: neat hexagonal wax cells, some capped, some holding amber honey.",
        "大小相同的格子，一次装满一整格。",
        "Cells of one size, filled a whole cell at a time.",
      ],
      [
        "bloom-filter",
        "剖开的花朵，柱头上落着几种形状的花粉粒。",
        "A flower in section with pollen grains of several shapes on the stigma.",
        "柱头只辨认形状，偶尔也会认错。",
        "The stigma recognises shapes, and occasionally gets one wrong.",
      ],
      [
        "backpropagation",
        "一片大叶的完整叶脉，细脉层层汇回主脉与叶柄。",
        "A large leaf's full venation, fine veins converging back to the midrib and petiole.",
        "细枝末节的信号，一路汇回主干。",
        "Signals from the finest veins flow back to the main stem.",
      ],
      [
        "tcp-congestion-control",
        "九只大雁排成均匀的人字形飞行。",
        "Nine wild geese flying in an even V formation.",
        "间距保持均匀，谁也不挤谁。",
        "Even spacing; nobody crowds anybody.",
      ],
    ] as const
  ).map(([slug, altZh, altEn, capZh, capEn]) => ({
    id: `plate-${slug}`,
    src: `/plates/web/${slug}.webp`,
    width: 1536,
    height: 1024,
    alt: { zh: altZh, en: altEn },
    caption: { zh: capZh, en: capEn },
    credit: CREDIT,
    license: LICENSE,
  })),
].map((a) => {
  // Real pixel sizes come from the prepare step, so a redrawn plate never ships a stale aspect ratio.
  const slug = a.src
    .split("/")
    .pop()!
    .replace(/\.webp$/, "") as keyof typeof plateSizes;
  return plateSizes[slug] ? { ...a, width: plateSizes[slug].width, height: plateSizes[slug].height } : a;
});
