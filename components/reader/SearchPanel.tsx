"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { Block } from "@/lib/types";
import type { SearchMatch } from "./ReflowView";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/lib/i18n/es";

/** Pasa a minúsculas y quita acentos conservando la longitud. */
const fold = (s: string) =>
  s.toLowerCase().replace(/[^\u0000-\u007f]/g, (c) => c.normalize("NFD")[0] ?? c);

export function findMatches(blocks: Block[], query: string): SearchMatch[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const out: SearchMatch[] = [];
  for (let i = 0; i < blocks.length && out.length < 3000; i++) {
    const text = fold(blocks[i].text);
    let at = text.indexOf(q);
    while (at >= 0 && out.length < 3000) {
      out.push({ blockIndex: i, start: at, end: at + q.length });
      at = text.indexOf(q, at + q.length);
    }
  }
  return out;
}

export function SearchPanel({
  blocks,
  query,
  matches,
  current,
  onQuery,
  onCurrent,
  onClose,
}: {
  blocks: Block[];
  query: string;
  matches: SearchMatch[];
  current: number;
  onQuery: (q: string, matches: SearchMatch[]) => void;
  onCurrent: (i: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(query);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const id = setTimeout(() => {
      if (text !== query) onQuery(text, findMatches(blocks, text));
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const list = useMemo(() => matches.slice(0, 200), [matches]);
  const step = (d: number) => {
    if (!matches.length) return;
    onCurrent((current + d + matches.length) % matches.length);
  };

  return (
    <Sheet title={t.reader.search} onClose={onClose} maxHeight="70dvh">
      <div className="flex items-center gap-2 py-2">
        <div className="relative flex-1">
          <input
            ref={input}
            className="field pr-10"
            value={text}
            placeholder={t.reader.searchPlaceholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && step(e.shiftKey ? -1 : 1)}
          />
          {text && (
            <button
              className="btn-icon absolute right-0 top-0"
              aria-label={t.reader.close}
              onClick={() => {
                setText("");
                onQuery("", []);
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <button className="btn-icon" aria-label={t.reader.prev} onClick={() => step(-1)}>
          <ChevronUp size={22} />
        </button>
        <button className="btn-icon" aria-label={t.reader.next} onClick={() => step(1)}>
          <ChevronDown size={22} />
        </button>
      </div>
      <p className="pb-2 text-sm text-muted">
        {query.trim().length >= 2
          ? matches.length
            ? `${current + 1} / ${matches.length} ${t.reader.matches}`
            : t.reader.noMatches
          : ""}
      </p>
      <ul>
        {list.map((m, i) => {
          const b = blocks[m.blockIndex].text;
          const a = Math.max(0, m.start - 30);
          return (
            <li key={i}>
              <button
                className={`min-h-11 w-full rounded-lg px-2 py-2 text-left text-sm active:bg-surface ${i === current ? "bg-surface" : ""}`}
                onClick={() => onCurrent(i)}
              >
                {a > 0 ? "…" : ""}
                {b.slice(a, m.start)}
                <b>{b.slice(m.start, m.end)}</b>
                {b.slice(m.end, m.end + 50)}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
