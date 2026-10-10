import Link from "next/link";
import { UserRound } from "lucide-react";
import type { Account, Author, Lang, Member } from "@/lib/model/types";
import { Bookplate } from "@/components/members/Bookplate";
import { translate } from "@/lib/i18n/dictionary";
import { HeaderFrame } from "@/components/motion/HeaderFrame";
import { LanguageToggle } from "./LanguageToggle";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { SearchTrigger } from "./SearchTrigger";
import { UserMenu } from "./UserMenu";

function Seal() {
  return (
    <svg
      viewBox="0 0 28 28"
      aria-hidden="true"
      className="size-7 shrink-0 text-ink transition-transform duration-(--dur-slow) ease-(--ease-grow) group-hover:rotate-[72deg]"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="14" cy="14" r="12.5" strokeWidth="1.2" />
      <circle cx="14" cy="14" r="9" strokeWidth="0.6" opacity="0.6" />
      <path d="M14 14 8.5 9m5.5 5 6-4m-6 4-1.5 7m1.5-7 6.5 3.5" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2" className="fill-brick" stroke="none" />
    </svg>
  );
}

/**
 * The running header of the book: a wordmark, three typed destinations, and
 * the reader's tools set small to the right. No boxed controls — every action
 * is a typed label, like the rest of the page.
 */
export function SiteHeader({
  lang,
  account,
  user,
  me,
}: {
  lang: Lang;
  account: Account | null;
  user: Author | null;
  me: Member | null;
}) {
  const t = (k: Parameters<typeof translate>[1]) => translate(lang, k);
  return (
    <HeaderFrame>
      <div className="mx-auto flex h-(--shell-header) max-w-(--content-max) items-center gap-2 px-3 sm:gap-6 sm:px-6 lg:gap-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 no-underline"
          aria-label={`Pioneer Wiki — ${t("nav.index")}`}
        >
          <Seal />
          <span className="font-display text-h4 leading-none font-[560] tracking-[-0.01em] text-ink">
            Pioneer <span className="italic">Wiki</span>
          </span>
        </Link>

        <nav aria-label={t("nav.primary")} className="hidden md:block">
          <NavLinks />
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4 lg:gap-6">
          <span className="hidden md:inline-flex">
            <SearchTrigger />
          </span>
          <span className="md:hidden">
            <SearchTrigger compact />
          </span>
          <LanguageToggle className="hidden md:inline-flex" />
          {account && account.status !== "suspended" && (account.authorId || account.role === "admin") ? (
            <Link href="/editor/new" className="pw-link hidden text-small text-ink-2 hover:text-ink lg:inline">
              {t("nav.create")}
            </Link>
          ) : null}
          {account ? (
            <Link
              href={me ? `/members/${me.handle}` : "/account"}
              className="group flex items-center gap-2 text-small text-ink-2 no-underline hover:text-ink"
              aria-label={me ? (lang === "zh" ? "我的主页" : "My page") : lang === "zh" ? "我的账号" : "My account"}
            >
              {me ? (
                <Bookplate
                  plate={me.plate}
                  name={me.name}
                  lang={lang}
                  mini
                  className="w-6 shadow-sheet transition-transform duration-(--dur-quick) group-hover:-rotate-6"
                />
              ) : (
                <UserRound aria-hidden="true" className="size-5 sm:hidden" />
              )}
              <span className="hidden sm:inline">{lang === "zh" ? "我的" : "Me"}</span>
            </Link>
          ) : null}
          <UserMenu account={account} user={user} me={me} />
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </div>
    </HeaderFrame>
  );
}
