import type { Metadata } from "next";
import { getServices } from "@/lib/services";
import { getLang } from "@/lib/i18n/server";
import { RunningHead } from "@/components/book/RunningHead";
import { AdminNav } from "@/components/admin/AdminNav";
import { AccessGate, gateReason } from "@/components/states/AccessGate";

export const metadata: Metadata = {
  title: { template: "%s · 管理后台 Admin", default: "管理后台 Admin" },
  robots: { index: false, follow: false },
};

/**
 * 编辑室 — the administrators' office. One register of rooms down the margin
 * (with what is waiting in each), the room on the right. Everyone else meets a
 * card that says why they cannot come in and what to do instead.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const lang = await getLang();
  const { auth, accounts } = getServices();
  const account = await auth.getCurrentAccount();
  const refused = gateReason(account, "admin");
  if (refused) return <AccessGate reason={refused} lang={lang} next="/admin" />;
  const todo = await accounts.todo().catch(() => null);
  return (
    <div className="flex flex-col gap-8">
      <RunningHead
        left={lang === "zh" ? "先锋维基 · 编辑室" : "Pioneer Wiki · Editorial office"}
        right={`${account!.name[lang]} · ${lang === "zh" ? "管理员" : "administrator"}`}
      />
      <div className="grid gap-x-(--space-block) gap-y-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <AdminNav todo={todo} />
        <div className="flex min-w-0 flex-col gap-8">{children}</div>
      </div>
    </div>
  );
}
