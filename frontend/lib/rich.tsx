import React from "react";
import katex from "katex";

export type RichPart = { math: boolean; display?: boolean; tex?: string; text?: string };

/** Split text into plain and math ($...$ / $$...$$) segments.
 *  Unclosed $ (e.g. from the typewriter effect slicing mid-formula) stays plain. */
export function splitMath(text: string): RichPart[] {
  const parts: RichPart[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ math: false, text: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ math: true, display: true, tex: m[1].trim() });
    else parts.push({ math: true, tex: m[2].trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ math: false, text: text.slice(last) });
  return parts;
}

export function MathSpan({ tex, display }: { tex: string; display?: boolean }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, { throwOnError: false, displayMode: !!display, strict: false }),
      }}
    />
  );
}

/** Render text with $...$ math; `plain` renders non-math chunks (e.g. bold). */
export function renderRich(text: string, plain?: (t: string, key: number) => React.ReactNode): React.ReactNode {
  const parts = splitMath(text);
  if (parts.length === 0) return text;
  return parts.map((p, i) =>
    p.math ? (
      <MathSpan key={i} tex={p.tex!} display={p.display} />
    ) : plain ? (
      plain(p.text!, i)
    ) : (
      <React.Fragment key={i}>{p.text}</React.Fragment>
    )
  );
}
