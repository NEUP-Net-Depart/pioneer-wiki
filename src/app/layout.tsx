import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource/noto-serif-sc/600.css";
import "katex/dist/katex.min.css";
import "./globals.css";
import { fell, newsreader, plexMono, sourceSans } from "./fonts";
import { PlateTones } from "@/components/book/PlateTones";
import { getLang } from "@/lib/i18n/server";
import { LanguageProvider } from "@/lib/i18n/client";
import { getServices } from "@/lib/services";
import { ArchiveShell } from "@/components/shell/ArchiveShell";
import { ReadingProvider } from "@/components/reading/ReadingProvider";
import { READING_COOKIE } from "@/lib/reading/preference";

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
  const textOnly = (await cookies()).get(READING_COOKIE)?.value === "text";
  const services = getServices();
  const [account, user, entries] = await Promise.all([
    services.auth.getCurrentAccount(),
    services.auth.getCurrentUser(),
    // A failing data store must not take the whole shell down; pages report their own errors.
    services.entries.listEntries().catch(() => []),
  ]);
  // The page the signed-in account owns, for the header's "Me" entry (archived pages included: the owner still sees them).
  const me = account?.memberId
    ? await services.community.getMember(account.memberId, { includeArchived: true }).catch(() => null)
    : null;

  return (
    <html
      lang={lang === "zh" ? "zh-CN" : "en"}
      data-reading={textOnly ? "text" : "illustrated"}
      className={`${newsreader.variable} ${sourceSans.variable} ${plexMono.variable} ${fell.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <PlateTones />
        <LanguageProvider initialLang={lang}>
          <ReadingProvider initialTextOnly={textOnly}>
            <ArchiveShell lang={lang} account={account} user={user} me={me} entryCount={entries.length}>
              {children}
            </ArchiveShell>
          </ReadingProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
