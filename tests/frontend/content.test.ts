import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { dictionaries } from "@/lib/i18n/dictionary";
import { extractToc } from "@/lib/markdown/toc";
import { opensWithSummary, splitHeading } from "@/lib/markdown/bilingual";
import { catalogueNumber, toRoman } from "@/lib/roman";
import { Markdown } from "@/components/markdown/Markdown";
import { marksSources } from "@/lib/markdown/citations";

describe("i18n dictionary", () => {
  it("has the same keys in both languages, none empty", () => {
    const zh = Object.keys(dictionaries.zh).sort();
    const en = Object.keys(dictionaries.en).sort();
    expect(en).toEqual(zh);
    for (const lang of ["zh", "en"] as const) {
      for (const [key, value] of Object.entries(dictionaries[lang])) expect(value, `${lang}:${key}`).not.toBe("");
    }
  });
});

describe("roman numerals", () => {
  it("formats plate and phylum numbers", () => {
    expect([1, 4, 9, 10, 14, 16, 2026].map(toRoman)).toEqual(["I", "IV", "IX", "X", "XIV", "XVI", "MMXXVI"]);
    expect(catalogueNumber("PW-0016")).toBe(16);
  });
});

describe("bilingual markdown", () => {
  const body = [
    ":::zh",
    "中文段落。",
    ":::",
    "",
    ":::en",
    "An English paragraph.",
    ":::",
    "",
    "## 推、拉与推拉 | Push, pull and push–pull",
    "",
    "### Plain heading",
    "",
    "```go",
    "func f() {}",
    "```",
  ].join("\n");

  it("splits 中文 | English headings", () => {
    expect(splitHeading("模型 | The model")).toEqual({ zh: "模型", en: "The model", text: "模型 | The model" });
    expect(splitHeading("Plain")).toEqual({ text: "Plain" });
  });

  it("gives the table of contents the same ids the renderer puts on headings", () => {
    const toc = extractToc(body);
    const html = renderToStaticMarkup(Markdown({ lang: "zh", children: body }));
    expect(toc.map((t) => t.id)).toEqual(["push-pull-and-pushpull", "plain-heading"]);
    for (const item of toc) expect(html).toContain(`id="${item.id}"`);
  });

  it("pairs adjacent zh/en blocks and labels code with its language", () => {
    const html = renderToStaticMarkup(Markdown({ lang: "en", children: body }));
    expect(html).toContain('class="pw-bi-pair"');
    expect(html).toMatch(/data-lang="zh"[^>]*>|lang="zh-CN"/);
    expect(html).toContain('data-lang="go"');
    expect(html).toMatch(/Go<span class="pw-code-count">1 line<\/span>/);
    // Line numbers live in their own aria-hidden gutter, never inside the code that gets copied.
    expect(html).toMatch(/<pre aria-hidden="true" class="pw-code-gutter">1<\/pre>/);
  });

  it("normalises CRLF so code and line counts carry no \\r", () => {
    const html = renderToStaticMarkup(Markdown({ lang: "zh", children: "```py\r\na = 1\r\nb = 2\r\n```\r\n" }));
    expect(html).not.toContain("\r");
    expect(html).toMatch(/<span class="pw-code-count">2 行<\/span>/);
  });

  it("renders typed callouts and bash code labels", () => {
    const html = renderToStaticMarkup(
      Markdown({ lang: "zh", children: "> [!tip]\n> 使用 bash 脚本部署。\n\n```bash\necho hi\n```" }),
    );
    expect(html).toContain('class="pw-callout pw-callout-tip"');
    expect(html).toContain('<span class="pw-callout-label">Tip</span>');
    expect(html).not.toContain("[!tip]");
    expect(html).toContain("Shell");
  });
});

describe("figures in the body", () => {
  const asset = {
    id: "asset-dot",
    src: "/api/media/dot.webp",
    width: 320,
    height: 200,
    alt: { zh: "一个圆点", en: "A dot" },
    credit: "Pioneer Wiki",
    license: "CC BY 4.0",
  };
  const body = ":::zh\n中文\n:::\n\n:::en\nEn\n:::\n\n![圆点](asset:asset-dot)\n";

  it("prints an asset reference as a captioned figure, never inside a paragraph", () => {
    const html = renderToStaticMarkup(Markdown({ lang: "zh", children: body, assets: { [asset.id]: asset } }));
    expect(html).toContain('<figure class="pw-figure">');
    expect(html).toContain('src="/api/media/dot.webp"');
    expect(html).toContain('alt="一个圆点"');
    expect(html).toContain("Pioneer Wiki · CC BY 4.0");
    expect(html).not.toMatch(/<p>\s*<figure/);
  });

  it("leaves out a figure that is not on file, and still drops unsafe addresses", () => {
    const html = renderToStaticMarkup(Markdown({ lang: "zh", children: body }));
    expect(html).not.toContain("<figure");
    expect(html).not.toContain('src=""');
    const unsafe = renderToStaticMarkup(Markdown({ lang: "en", children: "[x](javascript:alert(1))" }));
    expect(unsafe).not.toContain("javascript:");
  });
});

describe("the entry dek", () => {
  const body = [
    ":::zh",
    "**感知机**是一个线性分类器。它由 [罗森布拉特](https://example.org) 提出。",
    "",
    "## 定义 | Definition",
    ":::",
    "",
    ":::en",
    "The **perceptron** is a linear classifier.",
    ":::",
  ].join("\n");

  it("is left out when the body opens with the summary, emphasis and links aside", () => {
    expect(opensWithSummary(body, "感知机是一个线性分类器。它由罗森布拉特提出。", "zh")).toBe(true);
    expect(opensWithSummary(body, "The perceptron is a linear classifier.", "en")).toBe(true);
  });

  it("is kept when the summary says something the opening does not", () => {
    expect(opensWithSummary(body, "感知机是最早的神经网络之一。", "zh")).toBe(false);
    expect(opensWithSummary("No bilingual blocks here.", "No bilingual blocks here.", "en")).toBe(false);
  });
});

describe("source marks", () => {
  it("link each [S1] mark to its place in the record, keeping the mark's text", () => {
    const html = renderToStaticMarkup(
      Markdown({
        lang: "en",
        children: ":::en\nKernels isolate processes [S1]. Pages are cached [S1, S2]; see [S1-S3].\n:::",
      }),
    );
    expect(html).toContain('<sup class="pw-cite">[<a href="#source-1" class="pw-cite-link">S1</a>]</sup>');
    expect(html).toContain(
      '[<a href="#source-1" class="pw-cite-link">S1</a>, <a href="#source-2" class="pw-cite-link">S2</a>]',
    );
    expect(html).toContain(
      '<a href="#source-1" class="pw-cite-link">S1</a>–<a href="#source-3" class="pw-cite-link">S3</a>',
    );
    expect(marksSources("[S2] only")).toBe(true);
    expect(marksSources("A [link](https://example.org) and [Section 2]")).toBe(false);
  });
});
