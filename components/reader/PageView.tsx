"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import { loadPdfJs } from "@/lib/pdf";
import { prefersReducedMotion, type ViewApi, type ViewInfo } from "@/lib/paginate";

interface Props {
  pdf: PDFDocumentProxy;
  initialPage: number;
  dark: boolean;
  query: string;
  onMove: (page: number, info: ViewInfo) => void;
  onToggleUI: () => void;
  onEnd: () => void;
}

const MAX_ZOOM = 5;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const PageView = forwardRef<ViewApi, Props>(function PageView(props, ref) {
  const { pdf } = props;
  const total = pdf.numPages;
  const [page, setPage] = useState(() => clamp(props.initialPage, 1, total));
  const [root, setRoot] = useState({ w: 0, h: 0 });
  const [base, setBase] = useState({ w: 0, h: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const tf = useRef({ zoom: 1, x: 0, y: 0 });
  const token = useRef(0);
  const cache = useRef(new Map<string, HTMLCanvasElement>());
  const resRef = useRef(1);
  const latest = useRef(props);
  latest.current = props;
  const hiTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<RenderTask | null>(null);

  const applyTransform = useCallback(() => {
    const el = sheetRef.current;
    const r = rootRef.current;
    if (!el || !r) return;
    const t = tf.current;
    const w = el.offsetWidth * t.zoom;
    const h = el.offsetHeight * t.zoom;
    t.x = w <= r.clientWidth ? (r.clientWidth - w) / 2 : clamp(t.x, r.clientWidth - w, 0);
    t.y = h <= r.clientHeight ? (r.clientHeight - h) / 2 : clamp(t.y, r.clientHeight - h, 0);
    el.style.transform = `translate(${t.x}px,${t.y}px) scale(${t.zoom})`;
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRoot({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setRoot({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /** Devuelve el bitmap de una página (en caché o renderizado). */
  const bitmap = useCallback(
    async (n: number, fit: number, res: number, visible: boolean) => {
      const key = `${n}@${fit.toFixed(3)}@${res}`;
      const hit = cache.current.get(key);
      if (hit) return hit;
      const pg = await pdf.getPage(n);
      const dpr = window.devicePixelRatio || 1;
      let scale = fit * dpr * res;
      const v1 = pg.getViewport({ scale: 1 });
      const maxSide = 4096;
      scale = Math.min(scale, maxSide / Math.max(v1.width, v1.height));
      const vp = pg.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const task = pg.render({ canvasContext: c.getContext("2d")!, viewport: vp, canvas: c });
      if (visible) {
        pending.current?.cancel();
        pending.current = task;
      }
      await task.promise;
      cache.current.set(key, c);
      if (cache.current.size > 4) cache.current.delete(cache.current.keys().next().value as string);
      return c;
    },
    [pdf],
  );

  const show = useCallback(
    async (n: number, res: number, resetView: boolean) => {
      if (!root.w) return;
      const my = ++token.current;
      try {
        const pg = await pdf.getPage(n);
        const v1 = pg.getViewport({ scale: 1 });
        const fit = root.w / v1.width;
        const cssVp = pg.getViewport({ scale: fit });
        setBase({ w: cssVp.width, h: cssVp.height });
        const bmp = await bitmap(n, fit, res, true);
        if (my !== token.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.style.width = `${cssVp.width}px`;
        canvas.style.height = `${cssVp.height}px`;
        canvas.getContext("2d")!.drawImage(bmp, 0, 0);
        if (resetView) {
          tf.current = { zoom: 1, x: 0, y: 0 };
          requestAnimationFrame(applyTransform);
        }
        // capa de texto seleccionable
        if (resetView) {
          const container = textRef.current;
          if (container) {
            container.replaceChildren();
            container.style.setProperty("--total-scale-factor", String(fit));
            container.style.setProperty("--scale-factor", String(fit));
            const lib = await loadPdfJs();
            if (my !== token.current) return;
            const layer = new lib.TextLayer({ textContentSource: pg.streamTextContent(), container, viewport: cssVp });
            await layer.render();
            const q = latest.current.query.trim().toLowerCase();
            if (q && my === token.current) {
              container.querySelectorAll<HTMLElement>("span").forEach((sp) => {
                if (sp.textContent?.toLowerCase().includes(q)) sp.style.background = "#ff9d0099";
              });
            }
          }
          // precarga de la siguiente página
          if (n < total) setTimeout(() => void bitmap(n + 1, fit, res, false).catch(() => {}), 80);
        }
      } catch (e) {
        if ((e as { name?: string })?.name !== "RenderingCancelledException") console.error(e);
      }
    },
    [pdf, root.w, bitmap, applyTransform, total],
  );

  const info = useCallback((n: number): ViewInfo => ({ page: n, total, percent: total > 1 ? (n - 1) / (total - 1) : 1 }), [total]);

  // render al cambiar de página o de tamaño
  useEffect(() => {
    cache.current.clear();
    resRef.current = 1;
    void show(page, 1, true);
    latest.current.onMove(page, info(page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, root.w, props.query]);

  useEffect(() => applyTransform(), [base, root, applyTransform]);

  const go = useCallback(
    (n: number) => {
      if (n > total) return latest.current.onEnd();
      const t = clamp(n, 1, total);
      if (t === page) return;
      if (!prefersReducedMotion()) sheetRef.current?.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 160 });
      setPage(t);
    },
    [page, total],
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => go(page + 1),
      prev: () => go(page - 1),
      first: () => go(1),
      last: () => go(total),
      goPercent: (p) => go(Math.round(p * (total - 1)) + 1),
      goTo: () => {},
      goPdfPage: (n) => go(n),
      pageRange: () => null,
    }),
    [go, page, total],
  );

  // zoom reescalando el bitmap tras el gesto
  const scheduleHiRes = () => {
    clearTimeout(hiTimer.current);
    hiTimer.current = setTimeout(() => {
      const res = Math.min(4, Math.max(1, Math.ceil(tf.current.zoom)));
      if (res !== resRef.current) {
        resRef.current = res;
        void show(page, res, false);
      }
    }, 300);
  };

  const zoomAt = (cx: number, cy: number, z: number) => {
    const t = tf.current;
    const nz = clamp(z, 1, MAX_ZOOM);
    const px = (cx - t.x) / t.zoom;
    const py = (cy - t.y) / t.zoom;
    t.zoom = nz;
    t.x = cx - px * nz;
    t.y = cy - py * nz;
    applyTransform();
  };

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ mode: "none" | "pan" | "pinch"; x0: number; y0: number; t0: number; dist0: number; zoom0: number; moved: number }>({
    mode: "none",
    x0: 0,
    y0: 0,
    t0: 0,
    dist0: 1,
    zoom0: 1,
    moved: 0,
  });
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 1) {
      Object.assign(g, { mode: "pan", x0: e.clientX, y0: e.clientY, t0: Date.now(), moved: 0 });
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      Object.assign(g, { mode: "pinch", dist0: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom0: tf.current.zoom });
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const g = gesture.current;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const rect = rootRef.current!.getBoundingClientRect();
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      zoomAt(mx, my, g.zoom0 * (dist / g.dist0));
      g.moved = 99;
    } else if (g.mode === "pan") {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      g.moved += Math.abs(dx) + Math.abs(dy);
      tf.current.x += dx;
      tf.current.y += dy;
      applyTransform();
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === "pinch") {
      if (pointers.current.size === 0) g.mode = "none";
      scheduleHiRes();
      return;
    }
    if (g.mode !== "pan") return;
    g.mode = "none";
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    const tap = g.moved < 12 && Date.now() - g.t0 < 500;
    if (tf.current.zoom <= 1.02 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      return dx < 0 ? go(page + 1) : go(page - 1);
    }
    if (!tap) return scheduleHiRes();
    const rect = rootRef.current!.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const lt = lastTap.current;
    const isDouble = now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 40;
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    if (isDouble) {
      clearTimeout(tapTimer.current);
      lastTap.current.t = 0;
      if (tf.current.zoom > 1.05) tf.current = { zoom: 1, x: 0, y: 0 };
      else zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2.4);
      applyTransform();
      scheduleHiRes();
      return;
    }
    if (frac < 1 / 3 && tf.current.zoom <= 1.05) return go(page - 1);
    if (frac > 2 / 3 && tf.current.zoom <= 1.05) return go(page + 1);
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => latest.current.onToggleUI(), 250);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey) {
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, tf.current.zoom * Math.exp(-e.deltaY * 0.01));
        scheduleHiRes();
      } else {
        tf.current.y -= e.deltaY;
        tf.current.x -= e.deltaX;
        applyTransform();
      }
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => () => {
    clearTimeout(hiTimer.current);
    clearTimeout(tapTimer.current);
    pending.current?.cancel();
  }, []);

  const canvasStyle: React.CSSProperties = props.dark
    ? { filter: "invert(1) hue-rotate(180deg)", mixBlendMode: "screen", opacity: 0.82 }
    : { mixBlendMode: "multiply" };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={sheetRef}
        className="absolute left-0 top-0"
        style={{ width: base.w, height: base.h, transformOrigin: "0 0", background: "var(--bg)" }}
      >
        <canvas ref={canvasRef} style={canvasStyle} className="block" />
        <div ref={textRef} className="textLayer" />
      </div>
    </div>
  );
});
