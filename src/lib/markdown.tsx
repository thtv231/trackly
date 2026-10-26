import type { ReactNode } from "react";

// A small Markdown subset rendered straight to React elements, so raw HTML in the text is always shown as
// text and never parsed. Blocks: paragraphs, # headings, "-"/"*" and "1." lists.
// Inline: **bold**, *italic* / _italic_, `code`.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/;

function inline(text: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
        return <strong key={i}>{inline(part.slice(2, -2))}</strong>;
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
        return (
          <code key={i} className="rounded bg-zinc-100 px-1 font-mono text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        );
      if (/^(\*[^*].*\*|_[^_].*_)$/.test(part)) return <em key={i}>{inline(part.slice(1, -1))}</em>;
      return part;
    });
}

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    const k = blocks.length;
    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push(
        <p key={k} className="font-semibold">
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }
    const listRe = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null;
    if (listRe) {
      const items: ReactNode[] = [];
      while (i < lines.length && listRe.test(lines[i])) {
        items.push(<li key={items.length}>{inline(listRe.exec(lines[i])![1])}</li>);
        i++;
      }
      blocks.push(
        listRe === BULLET ? (
          <ul key={k} className="list-disc pl-6">
            {items}
          </ul>
        ) : (
          <ol key={k} className="list-decimal pl-6">
            {items}
          </ol>
        ),
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADING.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={k}>{inline(para.join(" "))}</p>);
  }
  return <div className="space-y-3">{blocks}</div>;
}
