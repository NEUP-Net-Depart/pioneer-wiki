import type { Account, Author, Lang, Member } from "@/lib/model/types";
import { translate } from "@/lib/i18n/dictionary";
import { PageTransition } from "@/components/motion/PageTransition";
import { RevealObserver } from "@/components/motion/RevealObserver";
import { SiteHeader } from "./SiteHeader";
import { Colophon } from "./Colophon";
import { SearchPalette } from "./SearchPalette";

/**
 * The book's binding: running header, the page itself (which turns on every
 * route change), the colophon. Pages render inside <main id="content">.
 */
export function ArchiveShell({
  lang,
  account,
  user,
  me,
  entryCount,
  children,
}: {
  lang: Lang;
  account: Account | null;
  user: Author | null;
  me: Member | null;
  entryCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only z-(--z-overlay) rounded-sm bg-ink px-3 py-2 text-small text-paper-sheet focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {translate(lang, "nav.skipToContent")}
      </a>
      <SiteHeader lang={lang} account={account} user={user} me={me} />
      <main
        id="content"
        tabIndex={-1}
        className="mx-auto w-full max-w-(--content-max) flex-1 px-4 pt-8 pb-16 outline-none sm:px-6 sm:pt-10"
      >
        <PageTransition>{children}</PageTransition>
      </main>
      <Colophon lang={lang} entryCount={entryCount} />
      <SearchPalette />
      <RevealObserver />
    </div>
  );
}
