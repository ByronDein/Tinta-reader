export interface RawItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
}

export interface Line {
  text: string;
  x: number;
  xEnd: number;
  y: number;
  size: number;
  bold: boolean;
  col: number;
  zone: "top" | "bottom" | "body";
}

export interface PageLines {
  page: number;
  lines: Line[];
}

interface It {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  bold: boolean;
}

const BOLD_RE = /bold|black|heavy|semibold|demi/i;

/** Detecta una separación central clara (dos columnas). Devuelve la x del hueco o null. */
function findGutter(items: It[], x0: number, x1: number): number | null {
  const width = x1 - x0;
  if (items.length < 20 || width <= 0) return null;
  const bins = 120;
  const cover = new Array<number>(bins).fill(0);
  for (const it of items) {
    const a = Math.max(0, Math.floor(((it.x - x0) / width) * bins));
    const b = Math.min(bins - 1, Math.floor(((it.x + it.w - x0) / width) * bins));
    for (let i = a; i <= b; i++) cover[i]++;
  }
  const tolerance = Math.max(1, Math.floor(items.length * 0.02));
  let best: [number, number] | null = null;
  let start = -1;
  for (let i = Math.floor(bins * 0.3); i <= Math.ceil(bins * 0.7); i++) {
    if (cover[i] <= tolerance) {
      if (start < 0) start = i;
      if (!best || i - start > best[1] - best[0]) best = [start, i];
    } else start = -1;
  }
  if (!best || best[1] - best[0] < 2) return null;
  const g = x0 + (((best[0] + best[1] + 1) / 2) / bins) * width;
  const left = items.filter((i) => i.x + i.w / 2 < g).length;
  const right = items.length - left;
  if (left < items.length * 0.2 || right < items.length * 0.2) return null;
  return g;
}

function groupLines(items: It[], col: number, view: number[]): Line[] {
  const H = view[3] - view[1];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Line[] = [];
  let cur: It[] = [];
  const flush = () => {
    if (!cur.length) return;
    cur.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = -Infinity;
    const sizeChars = new Map<number, number>();
    let boldChars = 0;
    let totalChars = 0;
    for (const it of cur) {
      const gap = it.x - prevEnd;
      if (text && gap > it.size * 0.12 && !text.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      text += it.str;
      prevEnd = it.x + it.w;
      const n = it.str.trim().length;
      const key = Math.round(it.size * 2) / 2;
      sizeChars.set(key, (sizeChars.get(key) ?? 0) + n);
      totalChars += n;
      if (it.bold) boldChars += n;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) {
      cur = [];
      return;
    }
    let size = cur[0].size;
    let max = -1;
    for (const [k, v] of sizeChars) if (v > max) ((max = v), (size = k));
    const y = cur[0].y;
    out.push({
      text,
      x: cur[0].x,
      xEnd: Math.max(...cur.map((i) => i.x + i.w)),
      y,
      size,
      bold: totalChars > 0 && boldChars >= totalChars * 0.9,
      col,
      zone: y > view[3] - H * 0.09 ? "top" : y < view[1] + H * 0.09 ? "bottom" : "body",
    });
    cur = [];
  };
  for (const it of sorted) {
    if (cur.length && Math.abs(it.y - cur[0].y) > Math.max(it.size, cur[0].size) * 0.45) flush();
    cur.push(it);
  }
  flush();
  return out;
}

export function pageToLines(
  rawItems: RawItem[],
  styles: Record<string, { fontFamily?: string }> | undefined,
  view: number[],
  pageNum: number,
): PageLines {
  const items: It[] = [];
  for (const r of rawItems) {
    if (typeof r.str !== "string" || !r.str.length || !r.transform) continue;
    // ignora texto vertical/rotado
    if (Math.abs(r.transform[1]) > Math.abs(r.transform[0]) * 0.3) continue;
    const size = Math.hypot(r.transform[0], r.transform[1]) || r.height;
    if (!size) continue;
    const fam = (r.fontName ? styles?.[r.fontName]?.fontFamily : "") ?? "";
    items.push({
      str: r.str,
      x: r.transform[4],
      y: r.transform[5],
      w: r.width,
      size,
      bold: BOLD_RE.test(fam) || BOLD_RE.test(r.fontName ?? ""),
    });
  }
  if (!items.length) return { page: pageNum, lines: [] };
  const x0 = view[0];
  const x1 = view[2];
  const gutter = findGutter(items, x0, x1);
  let lines: Line[];
  if (gutter === null) lines = groupLines(items, 0, view);
  else {
    const left = items.filter((i) => i.x + i.w / 2 < gutter);
    const right = items.filter((i) => i.x + i.w / 2 >= gutter);
    // cabeceras/pies que cruzan ambas columnas se mantienen como una sola línea de columna 0
    lines = [...groupLines(left, 0, view), ...groupLines(right, 1, view)];
  }
  return { page: pageNum, lines };
}
