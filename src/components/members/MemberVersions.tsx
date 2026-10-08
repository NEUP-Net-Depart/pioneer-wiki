"use client";

import { api } from "@/components/admin/actions";
import { VersionHistory } from "@/components/admin/VersionHistory";
import { useI18n } from "@/lib/i18n/client";

/** The page's version record, for its owner and administrators. */
export function MemberVersions({ handle }: { handle: string }) {
  const { lang } = useI18n();
  return (
    <VersionHistory
      label={lang === "zh" ? "版本记录" : "Versions"}
      endpoint={`/api/members/${handle}/versions`}
      restore={(n) => api(`/api/members/${handle}/versions`, "POST", { number: n })}
    />
  );
}
