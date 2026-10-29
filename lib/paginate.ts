import type { Block } from "./types";

/** Separación entre columnas (páginas) en px. */
export const GAP = 48;

export interface Chunk {
  start: number;
  /** exclusivo */
  end: number;
  chars: number;
  before: number;
}

export interface ViewInfo {
  page: number;
  total: number;
  percent: number;
}

export interface Pos {
  blockIndex: number;
  charOffset: number;
}

export interface ViewApi {
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
  goPercent: (p: number) => void;
  goTo: (blockIndex: number, charOffset: number) => void;
  goPdfPage: (page: number) => void;
  /** Rango de la página visible (solo modo lectura). */
  pageRange: () => { start: Pos; end: Pos } | null;
}

/** El libro se divide en tramos (~60k caracteres) que se maquetan por separado: la repaginación es instantánea. */
export function makeChunks(blocks: Block[]): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  let acc = 0;
  let before = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (i > start && ((acc >= 25000 && blocks[i].type === "h1") || acc >= 60000)) {
      chunks.push({ start, end: i, chars: acc, before });
      before += acc;
      start = i;
      acc = 0;
    }
    acc += blocks[i].text.length;
  }
  if (blocks.length) chunks.push({ start, end: blocks.length, chars: acc, before });
  return chunks;
}

export function chunkOf(chunks: Chunk[], blockIndex: number) {
  for (let i = 0; i < chunks.length; i++) if (blockIndex < chunks[i].end) return i;
  return Math.max(0, chunks.length - 1);
}

/** Caracteres acumulados antes de cada bloque. */
export function prefixChars(blocks: Block[]) {
  const cum = new Float64Array(blocks.length + 1);
  for (let i = 0; i < blocks.length; i++) cum[i + 1] = cum[i] + blocks[i].text.length;
  return cum;
}

export function blockAtChar(cum: Float64Array, char: number) {
  let lo = 0;
  let hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= char) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function nodeAt(el: Element, offset: number): { node: Text; offset: number } | null {
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let last: Text | null = null;
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    last = n;
    if (offset <= acc + n.data.length) return { node: n, offset: offset - acc };
    acc += n.data.length;
  }
  return last ? { node: last, offset: last.data.length } : null;
}

export function offsetIn(el: Element, node: Node, off: number) {
  if (node.nodeType !== Node.TEXT_NODE) {
    // posición entre hijos: cuenta el texto anterior
    const range = document.createRange();
    range.selectNodeContents(el);
    range.setEnd(node, off);
    return range.toString().length;
  }
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let acc = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n === node) return acc + off;
    acc += (n as Text).data.length;
  }
  return acc;
}

export function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

export const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
