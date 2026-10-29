import type { Block, BlockType } from "../types";
import type { Line, PageLines } from "./extract";

const PAGE_NUM_RE = /^[-–—\s]*(\d{1,4}|[ivxlc]{1,6})[-–—\s]*$/i;
const BULLET_RE = /^([•●▪◦·‣*]|[-–—]|\(?\d{1,3}[.)]|\(?[a-z][.)])\s+/;
const TERMINAL_RE = /[.!?…:;"”»)'’]$/;

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};
const percentile = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };
const clean = (s: string) => s.replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c).replace(/­/g, "");

function dropHeadersFooters(pages: PageLines[]): PageLines[] {
  const total = pages.length;
  const key = (l: Line) => l.text.replace(/\d+/g, "#").toLowerCase().trim();
  const parityTotals = [0, 0];
  const counts = new Map<string, [number, number]>();
  for (const p of pages) {
    const par = p.page % 2;
    parityTotals[par]++;
    const seen = new Set<string>();
    for (const l of p.lines) {
      if (l.zone === "body") continue;
      const k = l.zone + "|" + key(l);
      if (seen.has(k)) continue;
      seen.add(k);
      const c = counts.get(k) ?? [0, 0];
      c[par]++;
      counts.set(k, c);
    }
  }
  return pages.map((p) => ({
    page: p.page,
    lines: p.lines.filter((l) => {
      if (l.zone === "body") return true;
      if (PAGE_NUM_RE.test(l.text)) return false;
      if (total < 4) return true;
      const par = p.page % 2;
      const c = counts.get(l.zone + "|" + key(l))?.[par] ?? 0;
      return !(parityTotals[par] >= 2 && c / parityTotals[par] > 0.5);
    }),
  }));
}

interface Raw {
  type: BlockType;
  text: string;
  page: number;
  size: number;
  lastY: number;
}

export function buildBlocks(allPages: PageLines[]): Block[] {
  const pages = dropHeadersFooters(allPages);

  // estadísticas globales: tamaño mediano (ponderado por caracteres) y espaciado de línea
  const sizeWeights = new Map<number, number>();
  const spacings: number[] = [];
  for (const p of pages) {
    let prev: Line | null = null;
    for (const l of p.lines) {
      sizeWeights.set(l.size, (sizeWeights.get(l.size) ?? 0) + l.text.length);
      if (prev && prev.col === l.col) {
        const dy = prev.y - l.y;
        if (dy > 0 && dy < prev.size * 3) spacings.push(dy);
      }
      prev = l;
    }
  }
  let bodySize = 12;
  let best = -1;
  for (const [s, w] of sizeWeights) if (w > best) ((best = w), (bodySize = s));
  const spacing = median(spacings) || bodySize * 1.2;

  const raw: Raw[] = [];
  for (const p of pages) {
    for (const col of [0, 1]) {
      const lines = p.lines.filter((l) => l.col === col);
      if (!lines.length) continue;
      const left = percentile(lines.map((l) => l.x), 0.2);
      const right = percentile(lines.map((l) => l.xEnd), 0.85);
      let cur: Raw | null = null;
      let curBulletIndent = false;
      let prev: Line | null = null;
      const push = () => {
        if (cur && cur.text.trim()) raw.push(cur);
        cur = null;
      };
      for (const l of lines) {
        const text = clean(l.text);
        if (!text.trim()) continue;
        const ratio = l.size / bodySize;
        const heading: BlockType | null =
          ratio > 1.4 && text.length < 160
            ? "h1"
            : ratio > 1.15 && text.length < 160
              ? "h2"
              : l.bold && text.length < 90 && ratio >= 0.95 && !/[.,;]$/.test(text)
                ? "h2"
                : null;
        const gap = prev ? prev.y - l.y : 0;
        const bigGap = prev ? gap > spacing * 1.45 : false;
        const bullet = BULLET_RE.test(text) && !heading;
        const indented = l.x - left > bodySize * 0.9;
        const prevShort = prev ? prev.xEnd < right - bodySize * 3 : false;
        const prevEnds = prev ? TERMINAL_RE.test(prev.text) : false;

        const c: Raw | null = cur;
        let startNew = !c;
        if (c) {
          if (heading) startNew = !(c.type === heading && !bigGap && Math.abs(c.size - l.size) < 0.5);
          else if (c.type === "h1" || c.type === "h2") startNew = true;
          else if (bullet) startNew = true;
          else if (bigGap) startNew = true;
          else if (Math.abs(c.size - l.size) > bodySize * 0.15 && c.type !== "li") startNew = true;
          else if (indented && (prevEnds || prevShort)) startNew = true;
          else if (prevShort && prevEnds && !curBulletIndent) startNew = true;
        }
        if (startNew || !c) {
          push();
          cur = {
            type: heading ?? (bullet ? "li" : "p"),
            text,
            page: p.page,
            size: l.size,
            lastY: l.y,
          };
          curBulletIndent = bullet;
        } else {
          // une línea del mismo párrafo (arregla guiones de fin de línea)
          if (/[A-Za-zÀ-ÿ]-$/.test(c.text) && /^[a-zà-ÿ]/.test(text)) c.text = c.text.slice(0, -1) + text;
          else c.text += " " + text;
          c.lastY = l.y;
        }
        prev = l;
      }
      push();
    }
  }

  // une párrafos partidos entre columnas o páginas
  const out: Block[] = [];
  let last: Raw | null = null;
  for (const r of raw) {
    if (
      last &&
      last.type === "p" &&
      r.type === "p" &&
      !TERMINAL_RE.test(last.text) &&
      /^[a-zà-ÿ]/.test(r.text)
    ) {
      if (/[A-Za-zÀ-ÿ]-$/.test(last.text)) last.text = last.text.slice(0, -1) + r.text;
      else last.text += " " + r.text;
      continue;
    }
    if (last) out.push({ type: last.type, text: last.text.replace(/\s+/g, " ").trim(), page: last.page });
    last = r;
  }
  if (last) out.push({ type: last.type, text: last.text.replace(/\s+/g, " ").trim(), page: last.page });
  return out.filter((b) => b.text.length > 0);
}
