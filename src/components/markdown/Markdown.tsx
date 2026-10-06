import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Asset, Lang } from "@/lib/model/types";
import { remarkBilingual } from "@/lib/markdown/bilingual";
import { pick } from "@/lib/i18n/dictionary";
import type { Element, Root, RootContent } from "hast";
import { CopyButton } from "./CopyButton";

type HastNode = Root | RootContent | Element;

/*
 * Renders entry bodies: GFM (tables, footnotes, task lists), math, highlighted
 * code and bilingual blocks. Hook-free, so it renders in Server Components and
 * in the editor's client preview alike. Raw HTML is never rendered.
 */

/** Plain text of a hast subtree (what the copy button puts on the clipboard). */
function textOf(node: HastNode): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map((c) => textOf(c as HastNode)).join("") : "";
}

/** Display names for fenced-code language ids. */
const CODE_LANGUAGES: Record<string, string> = {
  py: "Python",
  python: "Python",
  go: "Go",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  javascript: "JavaScript",
  c: "C",
  cpp: "C++",
  rust: "Rust",
  java: "Java",
  sql: "SQL",
  bash: "Shell",
  sh: "Shell",
  json: "JSON",
  text: "Text",
  txt: "Text",
};

interface MarkdownProps {
  children: string;
  lang: Lang;
  /** Assets referenced as `![](asset:<id>)`. */
  assets?: Record<string, Asset>;
  className?: string;
}

export function Markdown({ children, lang, assets = {}, className }: MarkdownProps) {
  const components: Components = {
    // Code: a heavier typed slip with a tab naming the language, and a copy button.
    pre: ({ node, children, ...rest }) => {
      const code = node?.children[0];
      const classes = code && code.type === "element" ? code.properties.className : undefined;
      const id = Array.isArray(classes)
        ? classes
            .map(String)
            .find((c) => c.startsWith("language-"))
            ?.slice(9)
        : undefined;
      const label = id ? (CODE_LANGUAGES[id] ?? id) : "Text";
      const text = code ? textOf(code).replace(/\n$/, "") : "";
      const lines = text.split("\n").length;
      return (
        <figure className="pw-code" data-lang={id ?? "text"}>
          <figcaption className="pw-code-head">
            <span className="pw-code-lang">
              <span aria-hidden="true">❧</span>
              {label}
              <span className="pw-code-count">
                {lines} {lang === "zh" ? "行" : lines === 1 ? "line" : "lines"}
              </span>
            </span>
            <CopyButton lang={lang} text={text} />
          </figcaption>
          <div className="pw-code-body">
            {/* Ledger line numbers: a separate column, so copying the code never picks them up. */}
            <pre aria-hidden="true" className="pw-code-gutter">
              {Array.from({ length: lines }, (_, i) => i + 1).join("\n")}
            </pre>
            <pre {...rest}>{children}</pre>
          </div>
        </figure>
      );
    },
    // Section break: a printer's ornament between two inked rules.
    hr: () => (
      <div role="separator" className="pw-ornament">
        <span aria-hidden="true">❦</span>
      </div>
    ),
    table: (props) => (
      <div
        className="pw-table-wrap"
        tabIndex={0}
        role="region"
        aria-label={lang === "zh" ? "可横向滚动的表格" : "Scrollable table"}
      >
        <table {...props} />
      </div>
    ),
    img: ({ src, alt }) => {
      const ref = typeof src === "string" && src.startsWith("asset:") ? assets[src.slice(6)] : undefined;
      if (ref) {
        return (
          <figure className="pw-figure">
            {/* eslint-disable-next-line @next/next/no-img-element -- Markdown images have unknown sizes; plates use next/image elsewhere */}
            <img
              src={ref.src}
              alt={pick(ref.alt, lang)}
              width={ref.width}
              height={ref.height}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              {ref.caption ? <span>{pick(ref.caption, lang)}</span> : null}
              <span className="pw-credit">
                {ref.credit} · {ref.license}
              </span>
            </figcaption>
          </figure>
        );
      }
      // eslint-disable-next-line @next/next/no-img-element -- see above
      return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" decoding="async" />;
    },
  };

  return (
    <div className={className ? `pw-prose ${className}` : "pw-prose"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkDirective, remarkBilingual]}
        rehypePlugins={[
          [rehypeKatex, { strict: "ignore", throwOnError: false }],
          [rehypeHighlight, { detect: false }],
        ]}
        components={components}
      >
        {/* Normalise Windows line endings: copied code and line counts must not carry \r. */}
        {children.replace(/\r\n?/g, "\n")}
      </ReactMarkdown>
    </div>
  );
}
