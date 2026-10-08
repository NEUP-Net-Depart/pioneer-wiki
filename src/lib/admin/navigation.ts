import type { AdminTodo } from "@/lib/services/contracts";

export type AdminNavItem = { href: string; zh: string; en: string; count?: keyof AdminTodo };
export type AdminNavGroup = { zh: string; en: string; items: AdminNavItem[] };

export const ADMIN_GROUPS: AdminNavGroup[] = [
  { zh: "案头", en: "Desk", items: [{ href: "/admin", zh: "总览", en: "Overview" }] },
  {
    zh: "内容",
    en: "Content",
    items: [
      { href: "/admin/review", zh: "审核", en: "Review", count: "reviews" },
      { href: "/admin/entries", zh: "文章", en: "Entries" },
      { href: "/admin/assets", zh: "素材", en: "Images", count: "assets" },
      { href: "/admin/taxonomy", zh: "分类", en: "Catalogue" },
    ],
  },
  {
    zh: "人员",
    en: "People",
    items: [
      { href: "/admin/applications", zh: "资格申请", en: "Applications", count: "applications" },
      { href: "/admin/accounts", zh: "账号", en: "Accounts", count: "closures" },
    ],
  },
  {
    zh: "社区",
    en: "Community",
    items: [
      { href: "/admin/members", zh: "成员", en: "Members" },
      { href: "/admin/links", zh: "友链", en: "Links" },
      { href: "/admin/chronicles", zh: "纪行", en: "Chronicles" },
      { href: "/admin/forum", zh: "论坛", en: "Forum" },
    ],
  },
  {
    zh: "记录",
    en: "Records",
    items: [
      { href: "/admin/trash", zh: "回收站", en: "Archive bin" },
      { href: "/admin/audit", zh: "审计", en: "Audit" },
    ],
  },
];
