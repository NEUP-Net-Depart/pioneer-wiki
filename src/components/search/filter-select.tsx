"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The search filter field, drawn as a ledger line (`.pw-field`): a Radix
 * select dressed as the manuscript field, submitting with the page's GET form
 * through a hidden input. Radix items reject empty strings, so the "all"
 * option travels under a sentinel and the hidden input carries the real value.
 */
const ALL = "__all__";

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
}) {
  const [current, setCurrent] = useState(value === "" ? ALL : value);
  return (
    <label className="flex flex-col gap-1">
      <span className="pw-label">{label}</span>
      <input type="hidden" name={name} value={current === ALL ? "" : current} />
      <Select value={current} onValueChange={setCurrent}>
        <SelectTrigger className="pw-field h-9 w-full rounded-none border-0 px-0 text-small shadow-none focus-visible:border-0 focus-visible:ring-0 [&>svg]:text-ink-3">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map(([v, l]) => (
            <SelectItem key={v || ALL} value={v || ALL}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
