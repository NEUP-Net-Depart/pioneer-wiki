import type { EntrySummary, Lang, RelationKind, Relation } from "@/lib/model/types";
import { otherLang } from "@/lib/i18n/dictionary";
import { DOMAIN_IDS, RELATION_KINDS, RELATION_KIND_IDS } from "@/lib/model/vocab";
import { toRoman } from "@/lib/roman";

/*
 * 关系图版 — the knowledge graph drawn as a static geometric plate: specimens
 * on a circle grouped by phylum, curved hairline edges styled by relation kind.
 * Pure SVG from data, deterministic. Interaction (focus, pan, re-layout) is
 * Codex's (R3); `data-entry` / `data-relation` attributes are the hooks.
 */

const C = 500;
const R = 330;

const edgeStyle: Record<RelationKind, { className: string; dash?: string }> = {
  symbiosis: { className: "text-moss" },
  source: { className: "text-indigo" },
  taxonomy: { className: "text-ink" },
  contrast: { className: "text-ink-3", dash: "6 5" },
  dependency: { className: "text-indigo", dash: "1.5 4" },
  dispute: { className: "text-brick", dash: "8 4 1.5 4" },
};

const nodeFill = { draft: "fill-gold", in_review: "fill-indigo", published: "fill-moss" } as const;

export function RelationLegend({ lang }: { lang: "zh" | "en" }) {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 text-meta text-ink-2">
      {RELATION_KIND_IDS.map((k) => (
        <li key={k} className="flex items-center gap-2">
          <svg viewBox="0 0 32 6" aria-hidden="true" className={`h-1.5 w-8 ${edgeStyle[k].className}`}>
            <line
              x1="0"
              y1="3"
              x2="32"
              y2="3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={edgeStyle[k].dash}
            />
          </svg>
          {RELATION_KINDS[k].label[lang]}
          {RELATION_KINDS[k].symmetric ? "" : " →"}
        </li>
      ))}
    </ul>
  );
}

export function RelationPlate({
  entries,
  relations,
  title,
  lang,
}: {
  entries: EntrySummary[];
  relations: Relation[];
  title: string;
  lang: Lang;
}) {
  const other = otherLang(lang);
  const ordered = [...entries].sort(
    (a, b) => DOMAIN_IDS.indexOf(a.domain) - DOMAIN_IDS.indexOf(b.domain) || a.id.localeCompare(b.id),
  );
  const step = (2 * Math.PI) / ordered.length;
  const pos = new Map(
    ordered.map((e, i) => {
      const a = -Math.PI / 2 + i * step;
      return [e.id, { e, a, x: C + R * Math.cos(a), y: C + R * Math.sin(a), r: e.scale === "macro" ? 9 : 5.5 }];
    }),
  );

  // Phylum arcs just inside the ring.
  const arcs = DOMAIN_IDS.map((d, di) => {
    const members = ordered.map((e, i) => ({ e, i })).filter(({ e }) => e.domain === d);
    if (!members.length) return null;
    const a0 = -Math.PI / 2 + (members[0].i - 0.35) * step;
    const a1 = -Math.PI / 2 + (members[members.length - 1].i + 0.35) * step;
    const r = R - 34;
    const p = (a: number, rr = r) => `${C + rr * Math.cos(a)} ${C + rr * Math.sin(a)}`;
    const mid = (a0 + a1) / 2;
    return (
      <g key={d} className="text-ink-3">
        <path
          d={`M ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <text
          x={C + (r - 22) * Math.cos(mid)}
          y={C + (r - 22) * Math.sin(mid)}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current font-display text-[17px] italic"
        >
          {toRoman(di + 1)}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox="0 0 1000 1000" role="img" aria-label={title} className="pw-hairline h-auto w-full overflow-visible">
      <defs>
        <marker
          id="pw-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0 0.8 7 4 0 7.2" fill="none" stroke="currentColor" strokeWidth="1" />
        </marker>
      </defs>
      <circle cx={C} cy={C} r={R} fill="none" stroke="currentColor" strokeWidth="0.6" className="text-rule-strong" />
      {arcs}
      {relations.map((rel) => {
        const a = pos.get(rel.from);
        const b = pos.get(rel.to);
        if (!a || !b) return null;
        const cx = C + ((a.x + b.x) / 2 - C) * 0.18;
        const cy = C + ((a.y + b.y) / 2 - C) * 0.18;
        // Stop the curve at the target's edge so the arrowhead stays visible.
        const dx = cx - b.x;
        const dy = cy - b.y;
        const len = Math.hypot(dx, dy) || 1;
        const ex = b.x + (dx / len) * (b.r + 4);
        const ey = b.y + (dy / len) * (b.r + 4);
        const s = edgeStyle[rel.kind];
        return (
          <path
            key={rel.id}
            data-relation={rel.id}
            d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${ex} ${ey}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.6 + rel.strength * 0.45}
            strokeDasharray={s.dash}
            markerEnd={RELATION_KINDS[rel.kind].symmetric ? undefined : "url(#pw-arrow)"}
            className={s.className}
            opacity={0.85}
          />
        );
      })}
      {[...pos.values()].map(({ e, a, x, y, r }) => {
        const right = Math.cos(a) >= 0;
        const lx = C + (R + 20) * Math.cos(a);
        const ly = C + (R + 20) * Math.sin(a);
        return (
          <a key={e.id} href={`/entries/${e.slug}`} data-entry={e.id} className="group">
            {e.analogue ? (
              <circle
                cx={x}
                cy={y}
                r={r + 5}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                strokeDasharray="2 2.5"
                className="text-brick"
              />
            ) : null}
            <circle
              cx={x}
              cy={y}
              r={r}
              stroke="currentColor"
              strokeWidth="1"
              className={`${nodeFill[e.status]} text-ink`}
            />
            <text
              x={lx}
              y={ly}
              textAnchor={right ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-ink font-display text-[19px] group-hover:fill-indigo"
            >
              {e.title[lang]}
            </text>
            <text
              x={lx}
              y={ly + 19}
              textAnchor={right ? "start" : "end"}
              dominantBaseline="middle"
              lang={other === "zh" ? "zh-CN" : "en"}
              className="fill-ink-3 font-sans text-[13px]"
            >
              {e.title[other]}
            </text>
          </a>
        );
      })}
    </svg>
  );
}
