"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  deleteAnnotation,
  getBlocks,
  getBook,
  getFile,
  getMeta,
  getProgress,
  listAnnotations,
  putAnnotation,
  putBook,
  putProgress,
  setMeta,
} from "@/lib/db";
import { openPdf, type OpenedPdf } from "@/lib/pdf";
import { recordSeconds } from "@/lib/stats";
import { pullProgress, pushProgress } from "@/lib/sync";
import { sentenceAround } from "@/lib/lookup";
import { isDarkColor } from "@/lib/themes";
import { t } from "@/lib/i18n/es";
import type { Annotation, Block, Book, HighlightColor, Progress, ReadMode, TocItem } from "@/lib/types";
import type { Pos, ViewApi, ViewInfo } from "@/lib/paginate";
import { useSettings, useSettingsStore } from "@/store/settings";
import { ReflowView, type SearchMatch, type Selection } from "./ReflowView";
import { PageView } from "./PageView";
import { BottomBar, TopBar } from "./Bars";
import { SettingsPanel } from "./SettingsPanel";
import { TocPanel } from "./TocPanel";
import { SearchPanel } from "./SearchPanel";
import { AnnotationsPanel, ColorDots, HighlightEditor } from "./AnnotationsPanel";
import { LookupSheet } from "./LookupSheet";
import { ActionBar } from "./ActionBar";

type Panel = "settings" | "toc" | "search" | "notes" | null;
const DEFAULT_SPEED = 1100; // caracteres por minuto

interface Loaded {
  book: Book;
  blocks: Block[];
  progress?: Progress;
}

export function Reader() {
  const id = useSearchParams().get("id");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!id) return setMissing(true);
    let cancelled = false;
    void (async () => {
      const st = useSettingsStore.getState();
      if (!st.loaded) await st.load();
      await st.loadBook(id);
      const book = await getBook(id);
      if (!book) return !cancelled && setMissing(true);
      // si otro dispositivo leyó más reciente, empieza desde esa posición (máx. 2,5 s de espera)
      if (navigator.onLine) await Promise.race([pullProgress(id), new Promise((r) => setTimeout(r, 2500))]);
      const [blocks, progress] = await Promise.all([getBlocks(id), getProgress(id)]);
      if (!cancelled) setLoaded({ book, blocks: blocks ?? [], progress });
    })();
    return () => {
      cancelled = true;
      void useSettingsStore.getState().loadBook(null);
    };
  }, [id]);

  if (missing)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <p>{t.reader.notFound}</p>
        <Link href="/" className="btn">
          {t.reader.back}
        </Link>
      </div>
    );
  if (!loaded)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  return <ReaderInner {...loaded} />;
}

function ReaderInner({ book, blocks, progress }: Loaded) {
  const settings = useSettings();
  const hasBookOverride = useSettingsStore((s) => !!s.book);
  const canReflow = book.hasText && blocks.length > 0;
  const firstBlockOfPage = useCallback(
    (page: number) => {
      const i = blocks.findIndex((b) => b.page >= page);
      return i < 0 ? Math.max(0, blocks.length - 1) : i;
    },
    [blocks],
  );

  const [mode, setMode] = useState<ReadMode>(() => (canReflow ? (progress?.mode ?? "reflow") : "page"));
  const [ui, setUi] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [info, setInfo] = useState<ViewInfo>({ page: 1, total: 1, percent: progress?.percent ?? 0 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [lookup, setLookup] = useState<{ text: string; context: string } | null>(null);
  // subrayado tocado: muestra su barra para cambiar color, nota o quitarlo
  const [activeId, setActiveId] = useState<string | null>(null);
  // al tocar la barra el navegador puede soltar la selección antes del clic: se espera un momento antes de ocultarla
  const clearSel = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSelection = useCallback((s: Selection | null) => {
    clearTimeout(clearSel.current);
    if (s) {
      setSelection(s);
      setActiveId(null);
    } else clearSel.current = setTimeout(() => setSelection(null), 600);
  }, []);
  const [editing, setEditing] = useState<Annotation | null>(null);
  const [search, setSearch] = useState<{ query: string; matches: SearchMatch[]; current: number }>({ query: "", matches: [], current: 0 });
  const [notice, setNotice] = useState(!book.hasText ? t.reader.scanned : "");
  const [pdf, setPdf] = useState<OpenedPdf | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  const view = useRef<ViewApi>(null);
  const posRef = useRef({
    blockIndex: progress?.blockIndex ?? 0,
    charOffset: progress?.charOffset ?? 0,
    pdfPage: progress?.pdfPage ?? 1,
  });
  const lastInteraction = useRef(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const percentRef = useRef(info.percent);
  const sample = useRef<{ percent: number; t: number } | null>(null);
  const speedRef = useRef(DEFAULT_SPEED);
  const bookRef = useRef(book);

  const totalChars = useMemo(
    () => (canReflow ? blocks.reduce((a, b) => a + b.text.length, 0) : book.pageCount * 1800),
    [blocks, canReflow, book.pageCount],
  );

  // bloqueo de scroll de la página, anotaciones, velocidad guardada
  useEffect(() => {
    document.documentElement.classList.add("reader-lock");
    void listAnnotations(book.id).then(setAnnotations);
    void getMeta<number>("speed").then((v) => {
      if (v && v > 100) {
        speedRef.current = v;
        setSpeed(v);
      }
    });
    bookRef.current = { ...book, lastOpenedAt: Date.now() };
    void putBook(bookRef.current);
    return () => document.documentElement.classList.remove("reader-lock");
  }, [book]);

  // aviso de PDF escaneado
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  // PDF abierto solo cuando hace falta (modo página original)
  useEffect(() => {
    if (mode !== "page" || pdf) return;
    let dead = false;
    let opened: OpenedPdf | null = null;
    void (async () => {
      const blob = await getFile(book.id);
      if (!blob || dead) return;
      opened = await openPdf(blob);
      if (dead) opened.destroy();
      else setPdf(opened);
    })();
    return () => {
      dead = true;
    };
  }, [mode, pdf, book.id]);
  useEffect(() => () => pdf?.destroy(), [pdf]);

  // guardado de progreso
  const save = useCallback(() => {
    const p = percentRef.current;
    const status: Book["status"] = p >= 0.985 ? "done" : p > 0.002 ? "reading" : "new";
    const now = Date.now();
    const b = bookRef.current;
    const next: Book = { ...b, status, lastOpenedAt: now, finishedAt: status === "done" ? (b.finishedAt ?? now) : b.finishedAt };
    bookRef.current = next;
    void putBook(next);
    const prog: Progress = {
      bookId: b.id,
      mode: modeRef.current,
      blockIndex: posRef.current.blockIndex,
      charOffset: posRef.current.charOffset,
      pdfPage: posRef.current.pdfPage,
      percent: p,
      updatedAt: now,
    };
    void putProgress(prog);
    pushProgress(prog);
  }, []);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 500);
  }, [save]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      save();
      void setMeta("speed", speedRef.current);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [save]);

  const handleInfo = useCallback(
    (i: ViewInfo) => {
      setInfo(i);
      const prev = sample.current;
      const now = Date.now();
      // velocidad real: solo avances hacia delante con tiempos razonables
      if (prev && i.percent > prev.percent) {
        const dt = (now - prev.t) / 1000;
        if (dt > 3 && dt < 240) {
          const rate = ((i.percent - prev.percent) * totalChars) / (dt / 60);
          if (rate > 100 && rate < 12000) {
            speedRef.current = speedRef.current * 0.85 + rate * 0.15;
            setSpeed(speedRef.current);
          }
        }
      }
      if (!prev || i.percent !== prev.percent) sample.current = { percent: i.percent, t: now };
      percentRef.current = i.percent;
      lastInteraction.current = now;
      scheduleSave();
    },
    [scheduleSave, totalChars],
  );

  const onReflowMove = useCallback(
    (p: Pos, i: ViewInfo) => {
      posRef.current = { blockIndex: p.blockIndex, charOffset: p.charOffset, pdfPage: blocks[p.blockIndex]?.page ?? 1 };
      setActiveId(null);
      handleInfo(i);
    },
    [blocks, handleInfo],
  );
  const onPageMove = useCallback(
    (page: number, i: ViewInfo) => {
      posRef.current = { blockIndex: canReflow ? firstBlockOfPage(page) : 0, charOffset: 0, pdfPage: page };
      handleInfo(i);
    },
    [canReflow, firstBlockOfPage, handleInfo],
  );
  const onEnd = useCallback(() => {
    percentRef.current = 1;
    setInfo((i) => ({ ...i, percent: 1 }));
    save();
  }, [save]);

  // tiempo de lectura (solo con la pantalla visible y actividad reciente)
  useEffect(() => {
    let pending = 0;
    const iv = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastInteraction.current < 120000) {
        pending++;
        if (pending >= 15) {
          void recordSeconds(book.id, pending);
          pending = 0;
        }
      }
    }, 1000);
    return () => {
      clearInterval(iv);
      if (pending > 0) void recordSeconds(book.id, pending);
    };
  }, [book.id]);

  // pantalla encendida
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    void request();
    const vis = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", vis);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      void lock?.release().catch(() => {});
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const switchMode = useCallback(() => {
    if (!canReflow) return;
    save();
    setMode((m) => (m === "reflow" ? "page" : "reflow"));
  }, [canReflow, save]);

  // teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return;
      lastInteraction.current = Date.now();
      const v = view.current;
      if (!v) return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          return v.next();
        case " ":
          e.preventDefault();
          return e.shiftKey ? v.prev() : v.next();
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          return v.prev();
        case "Home":
          return v.first();
        case "End":
          return v.last();
        case "f":
        case "F":
          return toggleFullscreen();
        case "Escape":
          if (panel) setPanel(null);
          else setUi(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, toggleFullscreen]);

  // anotaciones
  const addAnnotation = useCallback(
    async (a: Omit<Annotation, "id" | "bookId" | "createdAt">) => {
      const full: Annotation = { ...a, id: crypto.randomUUID(), bookId: book.id, createdAt: Date.now() };
      await putAnnotation(full);
      setAnnotations((l) => [...l, full]);
      return full;
    },
    [book.id],
  );
  const saveAnnotation = useCallback(async (a: Annotation) => {
    await putAnnotation(a);
    setAnnotations((l) => l.map((x) => (x.id === a.id ? a : x)));
  }, []);
  const removeAnnotation = useCallback(async (id: string) => {
    await deleteAnnotation(id);
    setAnnotations((l) => l.filter((x) => x.id !== id));
  }, []);

  const highlight = async (color: HighlightColor, withNote = false) => {
    if (!selection) return;
    const a = await addAnnotation({
      kind: "highlight",
      color,
      blockIndex: selection.blockIndex,
      start: selection.start,
      end: selection.end,
      text: selection.text,
      page: blocks[selection.blockIndex]?.page ?? 1,
    });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    if (withNote) setEditing(a);
  };

  // marcador de la página visible
  const pageBookmarks = useCallback((): Annotation[] => {
    const marks = annotations.filter((a) => a.kind === "bookmark");
    if (modeRef.current === "page") return marks.filter((a) => a.page === posRef.current.pdfPage);
    const r = view.current?.pageRange();
    if (!r) return [];
    const key = (b: number, o: number) => b * 1e7 + o;
    return marks.filter((a) => key(a.blockIndex, a.start) >= key(r.start.blockIndex, r.start.charOffset) && key(a.blockIndex, a.start) <= key(r.end.blockIndex, r.end.charOffset));
  }, [annotations]);
  useEffect(() => {
    if (ui) setBookmarked(pageBookmarks().length > 0);
  }, [ui, info.page, annotations, mode, pageBookmarks]);

  const toggleBookmark = async () => {
    const existing = pageBookmarks();
    if (existing.length) {
      for (const a of existing) await removeAnnotation(a.id);
      return;
    }
    const p = posRef.current;
    const snippet = canReflow ? (blocks[p.blockIndex]?.text.slice(p.charOffset, p.charOffset + 80) ?? "") : "";
    await addAnnotation({ kind: "bookmark", blockIndex: p.blockIndex, start: p.charOffset, end: p.charOffset, text: snippet, page: p.pdfPage });
  };

  const openAnnotation = (a: Annotation) => {
    setPanel(null);
    if (mode === "page" || !canReflow) view.current?.goPdfPage(a.page);
    else view.current?.goTo(a.blockIndex, a.start);
  };
  const openToc = (item: TocItem) => {
    setPanel(null);
    if (mode === "page" || item.blockIndex < 0) view.current?.goPdfPage(item.page);
    else view.current?.goTo(item.blockIndex, 0);
  };

  const gotoMatch = (i: number, matches = search.matches) => {
    const m = matches[i];
    if (!m) return;
    setSearch((s) => ({ ...s, matches, current: i }));
    if (mode === "page") view.current?.goPdfPage(blocks[m.blockIndex]?.page ?? 1);
    else view.current?.goTo(m.blockIndex, m.start);
  };

  const remaining = (1 - info.percent) * totalChars;
  const minutesLeft = remaining / Math.max(100, speed);
  const dark = typeof document !== "undefined" && isDarkColor(getComputedStyle(document.documentElement).getPropertyValue("--bg") || "#fff");
  const activeAnn = activeId ? annotations.find((a) => a.id === activeId) : undefined;
  const lookupOf = (text: string, blockIndex: number, start: number, end: number) =>
    setLookup({ text, context: sentenceAround(blocks[blockIndex]?.text ?? "", start, end) });
  const editingLive = editing ? (annotations.find((a) => a.id === editing.id) ?? editing) : null;

  return (
    <div className="reader-root bg-bg" onPointerDownCapture={() => (lastInteraction.current = Date.now())}>
      {mode === "reflow" && canReflow ? (
        <ReflowView
          ref={view}
          key="reflow"
          blocks={blocks}
          settings={settings}
          initial={{ blockIndex: posRef.current.blockIndex, charOffset: posRef.current.charOffset }}
          annotations={annotations}
          matches={search.matches}
          currentMatch={search.current}
          onMove={onReflowMove}
          onToggleUI={() => {
            setActiveId(null);
            setUi((u) => !u);
          }}
          onSelection={onSelection}
          onHighlightClick={(hid) => {
            if (annotations.some((x) => x.id === hid)) setActiveId(hid);
          }}
          onEnd={onEnd}
        />
      ) : pdf ? (
        <PageView
          ref={view}
          key="page"
          pdf={pdf.pdf}
          initialPage={posRef.current.pdfPage}
          dark={dark}
          query={search.query}
          onMove={onPageMove}
          onToggleUI={() => setUi((u) => !u)}
          onEnd={onEnd}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="animate-spin" />
        </div>
      )}

      {/* línea fina de progreso */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[2px] bg-line/60">
        <div className="h-full bg-fg/70 transition-[width]" style={{ width: `${info.percent * 100}%` }} />
      </div>

      {notice && (
        <div className="safe-top absolute inset-x-0 top-0 z-30 p-3">
          <div className="mx-auto max-w-md rounded-xl bg-fg px-3 py-2 text-center text-sm text-bg">{notice}</div>
        </div>
      )}

      {ui && (
        <>
          <TopBar title={book.title} onSearch={() => setPanel("search")} onSettings={() => setPanel("settings")} />
          <BottomBar
            info={info}
            minutesLeft={minutesLeft}
            mode={mode}
            bookmarked={bookmarked}
            canReflow={canReflow}
            onSeek={(p) => view.current?.goPercent(p)}
            onToc={() => setPanel("toc")}
            onBookmark={() => void toggleBookmark()}
            onNotes={() => setPanel("notes")}
            onMode={switchMode}
            onFullscreen={toggleFullscreen}
          />
        </>
      )}

      {selection && mode === "reflow" && !panel && !lookup && !editing && (
        <ActionBar
          onColor={(c) => void highlight(c)}
          onNote={() => void highlight("yellow", true)}
          onLookup={() => {
            lookupOf(selection.text, selection.blockIndex, selection.start, selection.end);
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
          onClose={() => {
            window.getSelection()?.removeAllRanges();
            setSelection(null);
          }}
        />
      )}
      {!selection && activeAnn && activeAnn.kind !== "bookmark" && mode === "reflow" && !panel && !lookup && !editing && (
        <ActionBar
          color={activeAnn.color}
          onColor={(c) => void saveAnnotation({ ...activeAnn, color: c })}
          onNote={() => {
            setEditing(activeAnn);
            setActiveId(null);
          }}
          onLookup={() => {
            lookupOf(activeAnn.text, activeAnn.blockIndex, activeAnn.start, activeAnn.end);
            setActiveId(null);
          }}
          onRemove={() => {
            void removeAnnotation(activeAnn.id);
            setActiveId(null);
          }}
          onClose={() => setActiveId(null)}
        />
      )}

      {panel === "settings" && <SettingsPanel hasBookOverride={hasBookOverride} onClose={() => setPanel(null)} />}
      {panel === "toc" && <TocPanel toc={book.toc} onSelect={openToc} onClose={() => setPanel(null)} />}
      {panel === "search" && (
        <SearchPanel
          blocks={blocks}
          query={search.query}
          matches={search.matches}
          current={search.current}
          onQuery={(q, m) => {
            setSearch({ query: q, matches: m, current: 0 });
            if (m.length) gotoMatch(0, m);
          }}
          onCurrent={(i) => gotoMatch(i)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "notes" && (
        <AnnotationsPanel
          book={book}
          annotations={annotations}
          onOpen={openAnnotation}
          onEdit={(a) => {
            setPanel(null);
            setEditing(a);
          }}
          onDelete={(aid) => void removeAnnotation(aid)}
          onClose={() => setPanel(null)}
        />
      )}
      {lookup && <LookupSheet text={lookup.text} context={lookup.context} book={book} onClose={() => setLookup(null)} />}
      {editingLive && (
        <HighlightEditor ann={editingLive} onSave={(a) => void saveAnnotation(a)} onDelete={(aid) => void removeAnnotation(aid)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
