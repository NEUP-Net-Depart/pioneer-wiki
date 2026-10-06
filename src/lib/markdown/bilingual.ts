import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import type { Heading, Parent, Root, RootContent } from "mdast";
import { visit } from "unist-util-visit";

/*
 * Bilingual Markdown conventions (shared by renderer and table of contents):
 *
 *   :::zh / :::en          container blocks; adjacent zh + en blocks become a pair
 *   ## 中文标题 | English   heading in both languages (Chinese first)
 *
 * Which side reads as primary is decided in CSS from <html lang>, so switching
 * language reorders pairs instantly without re-rendering.
 */

export interface HeadingParts {
  zh?: string;
  en?: string;
  text: string;
}

export function splitHeading(text: string): HeadingParts {
  const i = text.indexOf(" | ");
  if (i === -1) return { text };
  return { zh: text.slice(0, i).trim(), en: text.slice(i + 3).trim(), text };
}

/** Heading anchor: the English half when present (URL-friendly), else the whole text. */
export function headingSlug(parts: HeadingParts, slugger: GithubSlugger): string {
  return slugger.slug(parts.en ?? parts.text);
}

export interface TocItem {
  id: string;
  depth: 2 | 3;
  parts: HeadingParts;
}

type DirectiveNode = Parent & { type: "containerDirective"; name: string; data?: Record<string, unknown> };

const LANG_ATTR = { zh: "zh-CN", en: "en" } as const;

/** remark plugin: bilingual containers, paired blocks and split headings with stable ids. */
export function remarkBilingual() {
  return (tree: Root) => {
    const slugger = new GithubSlugger();

    visit(tree, (node) => {
      if (node.type === "heading") {
        const heading = node as Heading;
        const parts = splitHeading(toString(heading));
        const id = headingSlug(parts, slugger);
        heading.data = { ...heading.data, hProperties: { id } };
        if (parts.zh !== undefined && parts.en !== undefined) {
          heading.children = (["zh", "en"] as const).map((lang) => ({
            type: "text" as const,
            value: parts[lang]!,
            data: {
              hName: "span",
              hProperties: { lang: LANG_ATTR[lang], "data-lang": lang, className: ["pw-h-part"] },
            },
          }));
        }
      }
    });

    visit(tree, (node) => {
      const d = node as unknown as DirectiveNode;
      if (d.type === "containerDirective" && (d.name === "zh" || d.name === "en")) {
        d.data = { hName: "div", hProperties: { lang: LANG_ATTR[d.name], "data-lang": d.name, className: ["pw-bi"] } };
      }
    });

    // Wrap each adjacent zh/en pair so CSS can order and style them together.
    visit(tree, (node) => {
      if (!("children" in node) || (node.data as { pwPair?: boolean } | undefined)?.pwPair) return;
      const parent = node as Parent;
      const out: RootContent[] = [];
      for (let i = 0; i < parent.children.length; i++) {
        const a = parent.children[i] as unknown as DirectiveNode;
        const b = parent.children[i + 1] as unknown as DirectiveNode | undefined;
        const isLang = (n?: DirectiveNode) => n?.type === "containerDirective" && (n.name === "zh" || n.name === "en");
        if (isLang(a) && isLang(b) && a.name !== b!.name) {
          out.push({
            type: "blockquote", // any mdast parent works; hName decides the element
            children: [a, b] as unknown as RootContent[],
            data: { hName: "div", hProperties: { className: ["pw-bi-pair"] }, pwPair: true },
          } as RootContent);
          i++;
        } else {
          out.push(parent.children[i] as RootContent);
        }
      }
      parent.children = out as Parent["children"];
    });
  };
}
