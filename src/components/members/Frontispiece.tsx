/* eslint-disable @next/next/no-img-element -- member uploads are served pre-sized from /api/media; next/image would re-encode them again */
import type { InkId, MemberCover } from "@/lib/model/types";
import { INKS } from "@/lib/model/vocab";
import { cn } from "@/lib/utils";

/**
 * The large image at the top of a member's page — their frontispiece. Shown as
 * uploaded, or printed in their ink; with no image, a marbled endpaper in their
 * ink stands in, as in a bound book.
 */
export function Frontispiece({
  cover,
  ink,
  alt,
  fade = true,
  className,
}: {
  cover?: MemberCover;
  ink: InkId;
  alt: string;
  fade?: boolean;
  className?: string;
}) {
  return (
    <div
      data-print={cover ? cover.print : "ink"}
      data-fade={fade || undefined}
      className={cn("pw-frontis", className)}
      style={{ "--plate-ink": INKS[ink].hex } as React.CSSProperties}
    >
      {cover ? (
        <img src={cover.src} width={cover.width} height={cover.height} alt={alt} fetchPriority="high" />
      ) : (
        <img src="/bookplate/marble-comb.webp" width={1600} height={1067} alt="" />
      )}
    </div>
  );
}
