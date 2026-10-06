"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Lang } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const LABELS = {
  zh: { idle: "复制", copied: "已复制", failed: "复制失败" },
  en: { idle: "Copy", copied: "Copied", failed: "Copy failed" },
} as const;

/**
 * A text action, never a boxed button: it must read like the other typed
 * labels around it. "slip" sits in a code slip's head strip (typed small
 * caps); "link" sits among record links (indigo, like "All rings →").
 */
export function CopyButton({
  text,
  lang,
  variant = "slip",
  idleLabel,
}: {
  text: string;
  lang: Lang;
  variant?: "slip" | "link";
  idleLabel?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const id = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(id);
  }, [state]);

  const label = state === "idle" ? (idleLabel ?? LABELS[lang].idle) : LABELS[lang][state];

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}
      data-state={state}
      className={cn("pw-copy", variant === "link" ? "pw-copy-link" : "pw-copy-slip")}
    >
      <span aria-live="polite">{label}</span>
      {variant === "link" ? (
        <span aria-hidden="true">{state === "copied" ? "✓" : state === "failed" ? "×" : "→"}</span>
      ) : state === "copied" ? (
        <Check aria-hidden="true" className="size-3 self-center" />
      ) : (
        <Copy aria-hidden="true" className="size-3 self-center" />
      )}
    </button>
  );
}
