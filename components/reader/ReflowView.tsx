"use client";
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Annotation, Block } from "@/lib/types";
import { fontCss, MARGIN_PX, type ReaderSettings } from "@/lib/settings";
import {
  GAP,
  blockAtChar,
  caretFromPoint,
  chunkOf,
  makeChunks,
  nodeAt,
  offsetIn,
  prefersReducedMotion,
  prefixChars,
  type Pos,
  type ViewApi,
  type ViewInfo,
} from "@/lib/paginate";

export interface Selection {
  blockIndex: number;
  start: number;
  end: number;
  text: string;
}
export interface SearchMatch {
  blockIndex: number;
  start: number;
  end: number;
}

interface Rng {
  s: number;
  e: number;
  cls: string;
  id?: string;
}

const BlockEl = memo(function BlockEl({ i, b, rngs }: { i: number; b: Block; rngs?: Rng[] }) {
  let content: React.ReactNode = b.text;
  if (rngs?.length) {
    const sorted = [...rngs].sort((x, y) => x.s - y.s);
    const out: React.ReactNode[] = [];
    let pos = 0;
    for (const r of sorted) {
      const s = Math.max(r.s, pos);
      const e = Math.min(r.e, b.text.length);
      if (e <= s) continue;
      if (s > pos) out.push(b.text.slice(pos, s));
      out.push(
        <mark key={s} className={r.cls} data-aid={r.id}>
          {b.text.slice(s, e)}
        </mark>,
      );
      pos = e;
    }
    if (pos < b.text.length) out.push(b.text.slice(pos));
    content = out;
  }
  if (b.type === "h1") return <h1 data-i={i}>{content}</h1>;
  if (b.type === "h2") return <h2 data-i={i}>{content}</h2>;
  if (b.type === "li") return <div className="li" data-i={i}>{content}</div>;
  return <p data-i={i}>{content}</p>;
});

interface Props {
  blocks: Block[];
  settings: ReaderSettings;
  initial: Pos;
  annotations: Annotation[];
  matches: SearchMatch[];
  currentMatch: number;
  onMove: (pos: Pos, info: ViewInfo) => void;
  onToggleUI: () => void;
  onSelection: (s: Selection | null) => void;
  onHighlightClick: (id: string) => void;
  onEnd: () => void;
}

type Target = { kind: "pos"; pos: Pos } | { kind: "page"; page: number } | { kind: "last" };

export const ReflowView = forwardRef<ViewApi, Props>(function ReflowView(props, ref) {
  const { blocks, settings: s, annotations, matches, currentMatch } = props;
  const chunks = useMemo(() => makeChunks(blocks), [blocks]);
  const cum = useMemo(() => prefixChars(blocks), [blocks]);
  const totalChars = cum[cum.length - 1] || 1;

  const [chunkIdx, setChunkIdx] = useState(() => chunkOf(chunks, props.initial.blockIndex));
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [fontTick, setFontTick] = useState(0);

  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const target = useRef<Target | null>({ kind: "pos", pos: props.initial });
  const pos = useRef<Pos>(props.initial);
  const measured = useRef(new Map<number, number>());
  const layoutSig = useRef("");
  const userNav = useRef(false);
  const animate = useRef(false);
  const slideOk = useRef(false);
  const prevChunk = useRef(chunkIdx);
  const latest = useRef(props);
  latest.current = props;

  const margin = MARGIN_PX[s.margin];
  const layoutKey = [s.font, s.size, s.lineHeight, s.letterSpacing, s.wordSpacing, s.margin, s.maxWidth, s.justify, s.indent, s.weight].join("|");

  // medir el área útil
  useLayoutEffect(() => {
    const el = clipRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDim({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDim({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // repaginar cuando carguen las fuentes
  useEffect(() => {
    const bump = () => setFontTick((n) => n + 1);
    void document.fonts.ready.then(bump);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);

  const estimate = useCallback(
    (c: number) => {
      const m = measured.current.get(c);
      if (m) return m;
      let ch = 0;
      let pg = 0;
      for (const [k, v] of measured.current) {
        ch += chunks[k].chars;
        pg += v;
      }
      const perPage = pg ? ch / pg : 1500;
      return Math.max(1, Math.ceil(chunks[c].chars / perPage));
    },
    [chunks],
  );

  const makeInfo = useCallback(
    (p: Pos, c: number, pg: number): ViewInfo => {
      // total estimado con la media de caracteres por página medida; la página sale del porcentaje,
      // así el número nunca salta hacia delante o atrás al medirse tramos nuevos
      let ch = 0;
      let np = 0;
      for (const [k, v] of measured.current) {
        ch += chunks[k].chars;
        np += v;
      }
      const perPage = np ? ch / np : 1500;
      const total = Math.max(1, Math.ceil(totalChars / perPage));
      const chars = cum[Math.min(p.blockIndex, blocks.length)] + p.charOffset;
      const percent = Math.min(1, chars / totalChars);
      void c;
      void pg;
      return { page: Math.max(1, Math.min(total, Math.floor(percent * total) + 1)), total, percent };
    },
    [chunks, cum, blocks.length, estimate, totalChars],
  );

  const pageOfPos = useCallback(
    (p: Pos, W: number) => {
      const content = contentRef.current;
      if (!content) return 0;
      const el = content.querySelector<HTMLElement>(`[data-i="${p.blockIndex}"]`);
      if (!el) return 0;
      let left: number;
      const at = p.charOffset > 0 ? nodeAt(el, p.charOffset) : null;
      if (at) {
        const r = document.createRange();
        r.setStart(at.node, at.offset);
        r.setEnd(at.node, Math.min(at.node.data.length, at.offset + 1));
        const rects = r.getClientRects();
        left = (rects[0] ?? r.getBoundingClientRect()).left;
      } else left = el.getBoundingClientRect().left;
      const rel = left - content.getBoundingClientRect().left;
      return Math.max(0, Math.floor((rel + 1) / (W + GAP)));
    },
    [],
  );

  /** Posición del primer carácter visible de la página actual. */
  const readPos = useCallback((): Pos => {
    const clip = clipRef.current;
    const content = contentRef.current;
    const fallback = pos.current;
    if (!clip || !content) return fallback;
    const r = clip.getBoundingClientRect();
    const lh = latest.current.settings.size * latest.current.settings.lineHeight;
    for (const dy of [0.5, 1.5, 2.5]) {
      const c = caretFromPoint(r.left + 4, r.top + lh * dy);
      if (!c) continue;
      const base = c.node.nodeType === Node.TEXT_NODE ? c.node.parentElement : (c.node as Element);
      const el = base?.closest<HTMLElement>("[data-i]");
      if (el && content.contains(el)) {
        return { blockIndex: Number(el.dataset.i), charOffset: offsetIn(el, c.node, c.offset) };
      }
    }
    return fallback;
  }, []);

  // maquetar el tramo actual y resolver el destino pendiente
  useLayoutEffect(() => {
    const content = contentRef.current;
    const clip = clipRef.current;
    if (!content || !clip || dim.w < 50 || dim.h < 50) return;
    const W = clip.clientWidth;
    const n = Math.max(1, Math.round((content.scrollWidth + GAP) / (W + GAP)));
    // si cambió el maquetado (fuente, tamaño, pantalla), las mediciones de otros tramos ya no sirven
    const sig = `${layoutKey}|${dim.w}|${dim.h}|${fontTick}`;
    if (layoutSig.current !== sig) {
      measured.current.clear();
      layoutSig.current = sig;
    }
    measured.current.set(chunkIdx, n);
    setPages(n);
    const t: Target = target.current ?? { kind: "pos", pos: pos.current };
    target.current = null;
    let p = 0;
    if (t.kind === "last") p = n - 1;
    else if (t.kind === "page") p = Math.min(n - 1, t.page);
    else {
      pos.current = t.pos;
      p = Math.min(n - 1, pageOfPos(t.pos, W));
    }
    setPage(p);
    setReady(true);
    if (t.kind === "pos") latest.current.onMove(t.pos, makeInfo(t.pos, chunkIdx, p));
    else userNav.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkIdx, layoutKey, dim.w, dim.h, fontTick, blocks]);

  // tras un cambio de página del usuario, leer la nueva posición
  useEffect(() => {
    if (!ready || !userNav.current) return;
    userNav.current = false;
    const p = readPos();
    pos.current = p;
    props.onMove(p, makeInfo(p, chunkIdx, page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, chunkIdx, ready]);

  // animación de página
  useEffect(() => {
    const chunkChanged = prevChunk.current !== chunkIdx;
    prevChunk.current = chunkIdx;
    slideOk.current = false;
    if (!animate.current) return;
    animate.current = false;
    if (prefersReducedMotion() || s.anim === "none") return;
    if (s.anim === "fade" || chunkChanged) {
      contentRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, chunkIdx]);

  const move = useCallback(
    (dir: 1 | -1) => {
      if (!ready) return;
      userNav.current = true;
      animate.current = true;
      if (dir === 1) {
        if (page < pages - 1) {
          slideOk.current = true;
          setPage(page + 1);
        } else if (chunkIdx < chunks.length - 1) {
          target.current = { kind: "page", page: 0 };
          setChunkIdx(chunkIdx + 1);
        } else {
          userNav.current = false;
          animate.current = false;
          props.onEnd();
        }
      } else if (page > 0) {
        slideOk.current = true;
        setPage(page - 1);
      } else if (chunkIdx > 0) {
        target.current = { kind: "last" };
        setChunkIdx(chunkIdx - 1);
      } else {
        userNav.current = false;
        animate.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, page, pages, chunkIdx, chunks.length],
  );

  const goTo = useCallback(
    (blockIndex: number, charOffset: number) => {
      const bi = Math.max(0, Math.min(blocks.length - 1, blockIndex));
      const p: Pos = { blockIndex: bi, charOffset: Math.max(0, charOffset) };
      animate.current = true;
      target.current = { kind: "pos", pos: p };
      const c = chunkOf(chunks, bi);
      if (c !== chunkIdx) setChunkIdx(c);
      else {
        // mismo tramo: recoloca sin re-maquetar
        const W = clipRef.current?.clientWidth ?? 0;
        const pg = Math.min(pages - 1, pageOfPos(p, W));
        target.current = null;
        pos.current = p;
        slideOk.current = true;
        setPage(pg);
        props.onMove(p, makeInfo(p, c, pg));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks.length, chunks, chunkIdx, pages, pageOfPos, makeInfo],
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => move(1),
      prev: () => move(-1),
      first: () => goTo(0, 0),
      last: () => goTo(blocks.length - 1, 0),
      goPercent: (pr) => {
        const bi = blockAtChar(cum, Math.max(0, Math.min(0.9999, pr)) * totalChars);
        goTo(bi, 0);
      },
      goTo,
      goPdfPage: (pg) => {
        const i = blocks.findIndex((b) => b.page >= pg);
        goTo(i < 0 ? blocks.length - 1 : i, 0);
      },
      pageRange: () => {
        const clip = clipRef.current;
        const content = contentRef.current;
        if (!clip || !content) return null;
        const start = readPos();
        const r = clip.getBoundingClientRect();
        let end = start;
        const c = caretFromPoint(r.right - 4, r.bottom - 4);
        if (c) {
          const base = c.node.nodeType === Node.TEXT_NODE ? c.node.parentElement : (c.node as Element);
          const el = base?.closest<HTMLElement>("[data-i]");
          if (el && content.contains(el)) end = { blockIndex: Number(el.dataset.i), charOffset: offsetIn(el, c.node, c.offset) };
        }
        return { start, end };
      },
    }),
    [move, goTo, blocks, cum, totalChars, readPos],
  );

  // anotaciones y búsqueda por bloque, limitadas al tramo visible
  const chunk = chunks[chunkIdx] ?? { start: 0, end: 0, chars: 0, before: 0 };
  const rangesByBlock = useMemo(() => {
    const m = new Map<number, Rng[]>();
    const add = (i: number, r: Rng) => {
      if (i < chunk.start || i >= chunk.end) return;
      const l = m.get(i);
      if (l) l.push(r);
      else m.set(i, [r]);
    };
    matches.forEach((mt, k) => add(mt.blockIndex, { s: mt.start, e: mt.end, cls: k === currentMatch ? "search current" : "search" }));
    for (const a of annotations) {
      if (a.kind === "bookmark") continue;
      add(a.blockIndex, { s: a.start, e: a.end, cls: `hl hl-${a.color ?? "yellow"}`, id: a.id });
    }
    return m;
  }, [matches, currentMatch, annotations, chunk.start, chunk.end]);

  // selección de texto -> subrayado
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const handler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const sel = window.getSelection();
        const content = contentRef.current;
        if (!sel || sel.isCollapsed || !content || !sel.rangeCount) return latest.current.onSelection(null);
        const r = sel.getRangeAt(0);
        const base = r.startContainer.nodeType === Node.TEXT_NODE ? r.startContainer.parentElement : (r.startContainer as Element);
        const el = base?.closest<HTMLElement>("[data-i]");
        if (!el || !content.contains(el)) return latest.current.onSelection(null);
        const start = offsetIn(el, r.startContainer, r.startOffset);
        const endEl = (r.endContainer.nodeType === Node.TEXT_NODE ? r.endContainer.parentElement : (r.endContainer as Element))?.closest<HTMLElement>("[data-i]");
        const end = endEl === el ? offsetIn(el, r.endContainer, r.endOffset) : (el.textContent ?? "").length;
        if (end <= start) return latest.current.onSelection(null);
        latest.current.onSelection({
          blockIndex: Number(el.dataset.i),
          start,
          end,
          text: (el.textContent ?? "").slice(start, end),
        });
      }, 150);
    };
    document.addEventListener("selectionchange", handler);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", handler);
    };
  }, []);

  // gestos: toque por tercios y deslizamiento
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = down.current;
    down.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    const sel = window.getSelection();
    const hasSel = !!sel && !sel.isCollapsed;
    const tap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - d.t < 500;
    if (hasSel) {
      if (tap) sel.removeAllRanges();
      return;
    }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) return move(dx < 0 ? 1 : -1);
    if (!tap) return;
    const mark = (e.target as HTMLElement).closest<HTMLElement>("mark[data-aid]");
    if (mark?.dataset.aid) return props.onHighlightClick(mark.dataset.aid);
    const frac = e.clientX / window.innerWidth;
    if (frac < 1 / 3) move(-1);
    else if (frac > 2 / 3) move(1);
    else props.onToggleUI();
  };

  const slide = s.anim === "slide" && !prefersReducedMotion();
  const W = dim.w;
  return (
    <div
      className="absolute inset-0"
      style={{
        paddingLeft: `calc(${margin}px + env(safe-area-inset-left, 0px))`,
        paddingRight: `calc(${margin}px + env(safe-area-inset-right, 0px))`,
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)}
    >
      <div
        ref={clipRef}
        className="mx-auto h-full w-full overflow-hidden"
        style={{
          maxWidth: `${s.maxWidth}ch`,
          fontFamily: fontCss(s.font),
          fontSize: s.size,
          lineHeight: s.lineHeight,
          letterSpacing: `${s.letterSpacing / 100}em`,
          wordSpacing: `${s.wordSpacing / 100}em`,
          fontWeight: s.weight,
          textAlign: s.justify ? "justify" : "left",
          hyphens: s.justify ? "auto" : "manual",
          WebkitHyphens: s.justify ? "auto" : "manual",
        }}
      >
        <div
          ref={contentRef}
          className={`reflow ${s.indent ? "indent" : "spaced"}`}
          style={{
            width: W || "100%",
            height: dim.h || "100%",
            columnWidth: W || undefined,
            columnGap: GAP,
            columnFill: "auto",
            transform: `translate3d(${-page * (W + GAP)}px,0,0)`,
            transition: slide && slideOk.current ? "transform 220ms ease-out" : "none",
            visibility: ready ? "visible" : "hidden",
          }}
        >
          {blocks.slice(chunk.start, chunk.end).map((b, k) => (
            <BlockEl key={chunk.start + k} i={chunk.start + k} b={b} rngs={rangesByBlock.get(chunk.start + k)} />
          ))}
        </div>
      </div>
    </div>
  );
});
