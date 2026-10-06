"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountActions({
  label,
  doneLabel,
  confirmLabel,
}: {
  label: string;
  doneLabel: string;
  confirmLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        disabled={busy || done}
        className="pw-link text-small text-brick-ink disabled:opacity-50"
        onClick={async () => {
          if (!window.confirm(confirmLabel)) return;
          setBusy(true);
          const response = await fetch("/api/account/delete-request", { method: "POST" });
          setBusy(false);
          if (response.ok) {
            setDone(true);
            router.refresh();
          }
        }}
      >
        {done ? doneLabel : label}
      </button>
    </div>
  );
}
