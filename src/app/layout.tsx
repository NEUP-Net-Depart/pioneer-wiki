import type { Metadata, Viewport } from "next";
import "@fontsource/noto-serif-sc/600.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import { fell, newsreader, plexMono, sourceSans } from "./fonts";
import { PlateTones } from "@/components/book/PlateTones";
import { getLang } from "@/lib/i18n/server";
import { LanguageProvider } from "@/lib/i18n/client";
import { getServices } from "@/lib/services";
import { ArchiveShell } from "@/components/shell/ArchiveShell";

export const metadata: Metadata = {
  title: { default: "先锋维基 · Pioneer Wiki", template: "%s · 先锋维基 Pioneer Wiki" },
  description: "A bilingual natural history of computer science. 一座按尺度、角色与关系编目的计算机科学博物馆。",
};

export const viewport: Viewport = {
  themeColor: "#e9e1d1",
};

/**
 * Runs before first paint: `data-js` (an attribute React does not manage, so
 * hydration keeps it) lets scroll reveals hide content that JS will
 * reveal (never without JS); `data-overture="play"` arms the opening montage on
 * the first home visit of a session unless the reader prefers reduced motion.
 */
const BOOT = `(function(){var d=document.documentElement;d.setAttribute("data-js","");try{if(location.pathname==="/"&&!sessionStorage.getItem("pw:overture")&&!matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.overture="play"}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  const services = getServices();
  const [account, user, entries, members] = await Promise.all([
    services.auth.getCurrentAccount(),
    services.auth.getCurrentUser(),
    services.entries.listEntries(),
    services.community.listMembers(),
  ]);
  // The signed-in reader's own member record, for the header's "Me" entry.
  const me = account?.authorId
    ? (members.find((m) => m.authorId === account.authorId) ?? null)
    : user
      ? (members.find((m) => m.authorId === user.id) ?? null)
      : null;

  return (
    <html
      lang={lang === "zh" ? "zh-CN" : "en"}
      className={`${newsreader.variable} ${sourceSans.variable} ${plexMono.variable} ${fell.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <PlateTones />
        <LanguageProvider initialLang={lang}>
          <ArchiveShell lang={lang} account={account} user={user} me={me} entryCount={entries.length}>
            {children}
          </ArchiveShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
