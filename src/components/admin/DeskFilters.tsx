"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterSelect } from "@/components/search/filter-select";
import { useI18n } from "@/lib/i18n/client";

export interface FilterField {
  name: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
}

/**
 * Search and filters for a register, carried in the address so a list can be
 * linked, reloaded and returned to at the same place. Choosing a filter applies
 * it at once; the text applies on Enter or the search button.
 */
export function DeskFilters({
  text,
  textLabel,
  filters = [],
}: {
  text?: { value: string; placeholder?: string };
  textLabel?: string;
  filters?: FilterField[];
}) {
  const { lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const apply = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    const query = new URLSearchParams();
    for (const [key, value] of data) if (typeof value === "string" && value.trim()) query.set(key, value.trim());
    const search = query.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };
  return (
    <form
      ref={form}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
      className="grid items-end gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,2fr)_repeat(3,minmax(9rem,1fr))_auto]"
    >
      {text ? (
        <label className="flex flex-col gap-1">
          <span className="pw-label">{textLabel ?? (lang === "zh" ? "搜索" : "Search")}</span>
          <input
            type="search"
            name="q"
            defaultValue={text.value}
            placeholder={text.placeholder}
            className="pw-field h-9 text-small"
          />
        </label>
      ) : null}
      {filters.map((filter) => (
        <FilterSelect
          key={`${filter.name}:${filter.value}`}
          name={filter.name}
          label={filter.label}
          value={filter.value}
          options={filter.options}
          onValueChange={() => requestAnimationFrame(apply)}
        />
      ))}
      <button type="submit" className="pw-link min-h-11 justify-self-start text-small text-ink">
        {lang === "zh" ? "检索" : "Search"} →
      </button>
    </form>
  );
}
