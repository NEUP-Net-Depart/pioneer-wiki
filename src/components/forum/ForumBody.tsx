import { Markdown } from "@/components/markdown/Markdown";

/**
 * A forum post as Markdown. Single line breaks are kept, as people expect in
 * a comment; raw HTML is never rendered (see Markdown).
 */
export function ForumBody({ body, lang }: { body: string; lang: "zh" | "en" }) {
  const kept = body.replace(/([^\n])\n(?!\n)/g, "$1  \n");
  return (
    <div className="pw-forum-body">
      <Markdown lang={lang}>{kept}</Markdown>
    </div>
  );
}
