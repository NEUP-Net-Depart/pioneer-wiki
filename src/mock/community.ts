import type { ForumPost, ForumThread, FriendLink, Member } from "@/lib/model/types";

/*
 * Community fixtures. 青空 is the only real member so far; every other person
 * (members and forum writers) is an obvious placeholder, and every record marked
 * `sample: true` carries a "sample" stamp on the page until the society
 * supplies its real friend links and member list.
 */

export const links: FriendLink[] = [
  {
    id: "l-oiwiki",
    name: { zh: "OI Wiki", en: "OI Wiki" },
    url: "https://oi-wiki.org",
    description: {
      zh: "编程竞赛知识整合站点，从入门到进阶的算法与数据结构。",
      en: "Competitive-programming knowledge, from first algorithms to advanced data structures.",
    },
    emblem: "geo-lighthouse",
    since: "2026-06-01",
    sample: true,
  },
  {
    id: "l-hello-algo",
    name: { zh: "Hello 算法", en: "Hello Algo" },
    url: "https://www.hello-algo.com",
    description: {
      zh: "动画图解、一键运行的数据结构与算法教程。",
      en: "Data structures and algorithms with animated diagrams and runnable code.",
    },
    emblem: "geo-ship",
    since: "2026-06-18",
    sample: true,
  },
  {
    id: "l-csdiy",
    name: { zh: "CS 自学指南", en: "CS Self-Learning Guide" },
    url: "https://csdiy.wiki",
    description: {
      zh: "一份计算机科学自学路线与公开课索引。",
      en: "A self-study roadmap and an index of open computer-science courses.",
    },
    emblem: "geo-compass",
    since: "2026-07-02",
    sample: true,
  },
  {
    id: "l-ctfwiki",
    name: { zh: "CTF Wiki", en: "CTF Wiki" },
    url: "https://ctf-wiki.org",
    description: {
      zh: "网络安全竞赛的知识与工具汇编。",
      en: "Knowledge and tools for capture-the-flag security contests.",
    },
    emblem: "geo-sextant",
    since: "2026-07-20",
    sample: true,
  },
  {
    id: "l-missing",
    name: { zh: "计算机教育中缺失的一课", en: "The Missing Semester" },
    url: "https://missing.csail.mit.edu",
    description: {
      zh: "命令行、版本控制、调试——课堂上很少讲却天天要用的工具。",
      en: "The shell, version control, debugging — tools you use daily but are rarely taught.",
    },
    emblem: "geo-globe",
    since: "2026-08-09",
    sample: true,
  },
  {
    id: "l-mdn",
    name: { zh: "MDN Web 文档", en: "MDN Web Docs" },
    url: "https://developer.mozilla.org",
    description: {
      zh: "Web 平台的权威参考：HTML、CSS、JavaScript 与浏览器 API。",
      en: "The reference for the web platform: HTML, CSS, JavaScript and browser APIs.",
    },
    emblem: "geo-islands",
    since: "2026-09-12",
    sample: true,
  },
];

export const members: Member[] = [
  {
    id: "m-qingkong",
    name: { zh: "青空", en: "Qingkong" },
    handle: "qingkong",
    role: { zh: "主编 · 撰稿", en: "Editor · Author" },
    bio: {
      zh: "先锋维基的主编，目前所有条目的作者。",
      en: "Editor of Pioneer Wiki and author of every entry so far.",
    },
    about:
      ":::zh\n先锋维基的主编，目前所有条目的作者。\n\n这里还可以写更长的自我介绍——在「编辑我的主页」里修改。\n:::\n\n:::en\nEditor of Pioneer Wiki and author of every entry so far.\n\nA longer introduction can go here — edit it from “Edit my page”.\n:::\n",
    plate: { number: 1, emblem: "ex-swallow", ink: "prussian", border: "fleuron", motto: "Ad caelum · 向着青空" },
    joined: "2026-06-01",
    authorId: "a-qingkong",
    links: [{ label: "GitHub", url: "https://github.com/puresky271" }],
    github: "puresky271",
  },
  {
    id: "m-sample-a",
    name: { zh: "示例成员甲", en: "Sample member A" },
    handle: "sample-a",
    role: { zh: "插画", en: "Illustration" },
    bio: { zh: "占位示例，等待真实成员信息。", en: "Placeholder until the real member is added." },
    about:
      ":::zh\n这是一个占位的示例成员，用来展示个人主页的版式。真实成员加入后，这里会换成他们自己写的介绍。\n:::\n\n:::en\nA placeholder member, here to show the layout of a personal page. It will be replaced by a real member's own introduction.\n:::\n",
    plate: { number: 2, emblem: "ex-palette", ink: "madder", border: "vine", motto: "Exemplum" },
    joined: "2026-06-20",
    links: [],
    sample: true,
  },
  {
    id: "m-sample-b",
    name: { zh: "示例成员乙", en: "Sample member B" },
    handle: "sample-b",
    role: { zh: "审校", en: "Review" },
    bio: { zh: "占位示例，等待真实成员信息。", en: "Placeholder until the real member is added." },
    about:
      ":::zh\n这是一个占位的示例成员，用来展示个人主页的版式。真实成员加入后，这里会换成他们自己写的介绍。\n:::\n\n:::en\nA placeholder member, here to show the layout of a personal page. It will be replaced by a real member's own introduction.\n:::\n",
    plate: { number: 3, emblem: "ex-owl", ink: "verdigris", border: "meander", motto: "Exemplum" },
    joined: "2026-07-04",
    links: [],
    sample: true,
  },
  {
    id: "m-sample-c",
    name: { zh: "示例成员丙", en: "Sample member C" },
    handle: "sample-c",
    role: { zh: "排版 · 前端", en: "Typesetting · Front end" },
    bio: { zh: "占位示例，等待真实成员信息。", en: "Placeholder until the real member is added." },
    about:
      ":::zh\n这是一个占位的示例成员，用来展示个人主页的版式。真实成员加入后，这里会换成他们自己写的介绍。\n:::\n\n:::en\nA placeholder member, here to show the layout of a personal page. It will be replaced by a real member's own introduction.\n:::\n",
    plate: { number: 4, emblem: "ex-compass", ink: "sepia", border: "rope", motto: "Exemplum" },
    joined: "2026-08-15",
    links: [],
    sample: true,
  },
  {
    id: "m-sample-d",
    name: { zh: "示例成员丁", en: "Sample member D" },
    handle: "sample-d",
    role: { zh: "交流区主持", en: "Forum host" },
    bio: { zh: "占位示例，等待真实成员信息。", en: "Placeholder until the real member is added." },
    about:
      ":::zh\n这是一个占位的示例成员，用来展示个人主页的版式。真实成员加入后，这里会换成他们自己写的介绍。\n:::\n\n:::en\nA placeholder member, here to show the layout of a personal page. It will be replaced by a real member's own introduction.\n:::\n",
    plate: { number: 5, emblem: "ex-lighthouse", ink: "vermilion", border: "fleuron", motto: "Exemplum" },
    joined: "2026-09-01",
    links: [],
    sample: true,
  },
];

const t = (
  n: number,
  title: string,
  category: ForumThread["category"],
  authorName: string,
  createdAt: string,
  memberId?: string,
): Omit<ForumThread, "lastActivityAt" | "postCount" | "excerpt"> => ({
  id: `t-${n}`,
  number: n,
  title,
  category,
  authorName,
  memberId,
  createdAt,
});

export const threadSeeds = [
  t(1, "欢迎来到交流区 · 发帖须知", "meta", "青空", "2026-09-01T10:00:00+08:00", "m-qingkong"),
  t(2, "流言协议的收敛轮次，有没有更直观的推导？", "help", "示例访客甲", "2026-09-22T21:14:00+08:00"),
  t(
    3,
    "Drew a fern with an L-system — sharing the code",
    "showcase",
    "示例成员丁",
    "2026-09-27T09:30:00+08:00",
    "m-sample-d",
  ),
  t(4, "条目插画的隐喻怎么选？", "general", "示例成员乙", "2026-10-01T15:02:00+08:00", "m-sample-b"),
];

export const postSeeds: ForumPost[] = [
  {
    id: "p-1-1",
    threadId: "t-1",
    authorName: "青空",
    memberId: "m-qingkong",
    createdAt: "2026-09-01T10:00:00+08:00",
    body: "这里是先锋维基的交流区。提问、分享、对条目提意见都可以。\n\n发帖前请先搜一搜是否已有相同话题；讨论某个条目时，请附上它的编号（例如 PW-0001）。",
  },
  {
    id: "p-2-1",
    threadId: "t-2",
    authorName: "示例访客甲",
    createdAt: "2026-09-22T21:14:00+08:00",
    body: "条目里说推拉混合大约 log₃ n 轮，我能接受 log₂ n，但 log₃ 是从哪来的？",
  },
  {
    id: "p-2-2",
    threadId: "t-2",
    authorName: "青空",
    memberId: "m-qingkong",
    createdAt: "2026-09-23T08:40:00+08:00",
    body: "前期像推：知道的人每轮大约翻倍。后期像拉：每个还不知道的节点每轮去问一个人，不知道的比例每轮大约平方一次。两段合起来，就是条目里那个式子。\n\n我会在下一版里补一张示意图。",
  },
  {
    id: "p-3-1",
    threadId: "t-3",
    authorName: "示例成员丁",
    memberId: "m-sample-d",
    createdAt: "2026-09-27T09:30:00+08:00",
    body: "Axiom X, rules X → F+[[X]-X]-F[-FX]+X and F → FF, angle 25°. Five generations give a very convincing fern. Turtle code in the thread below if anyone wants it.",
  },
  {
    id: "p-3-2",
    threadId: "t-3",
    authorName: "示例访客乙",
    createdAt: "2026-09-28T19:05:00+08:00",
    body: "Lovely. Try a random angle jitter of ±3° — it stops looking like a diagram and starts looking like a plant.",
  },
  {
    id: "p-4-1",
    threadId: "t-4",
    authorName: "示例成员乙",
    memberId: "m-sample-b",
    createdAt: "2026-10-01T15:02:00+08:00",
    body: "我们定了一条规矩：插画必须说出条目的一件真事，而不是只和名字押韵。B 树不画树枝，画图书馆的卡片目录；TCP 拥塞控制画追浪的滨鹬。大家还有什么好例子？",
  },
];
