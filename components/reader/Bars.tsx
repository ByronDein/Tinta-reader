"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Bookmark, BookOpen, FileText, List, Maximize, NotebookPen, Search, SlidersHorizontal } from "lucide-react";
import type { ReadMode } from "@/lib/types";
import type { ViewInfo } from "@/lib/paginate";
import { t } from "@/lib/i18n/es";

export function TopBar({
  title,
  onSearch,
  onSettings,
}: {
  title: string;
  onSearch: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="safe-top absolute inset-x-0 top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2" style={{ paddingLeft: "max(8px, env(safe-area-inset-left))", paddingRight: "max(8px, env(safe-area-inset-right))" }}>
        <Link href="/" className="btn-icon" aria-label={t.reader.back}>
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1 truncate px-1 text-center text-sm font-medium">{title}</div>
        <button className="btn-icon" onClick={onSearch} aria-label={t.reader.search}>
          <Search size={21} />
        </button>
        <button className="btn-icon" onClick={onSettings} aria-label={t.reader.settings}>
          <SlidersHorizontal size={21} />
        </button>
      </div>
    </div>
  );
}

function formatLeft(minutes: number) {
  if (minutes < 1) return t.reader.lessThanMin;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} ${t.reader.hours} ${m} ${t.reader.minutes}` : `${m} ${t.reader.minutes}`;
}

export function BottomBar({
  info,
  minutesLeft,
  mode,
  bookmarked,
  onSeek,
  onToc,
  onBookmark,
  onNotes,
  onMode,
  onFullscreen,
  canReflow,
}: {
  info: ViewInfo;
  minutesLeft: number;
  mode: ReadMode;
  bookmarked: boolean;
  onSeek: (p: number) => void;
  onToc: () => void;
  onBookmark: () => void;
  onNotes: () => void;
  onMode: () => void;
  onFullscreen: () => void;
  canReflow: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? Math.round(info.percent * 1000);
  const shownPct = Math.round((value / 1000) * 100);
  const commit = () => {
    if (drag !== null) onSeek(drag / 1000);
    setDrag(null);
  };
  return (
    <div
      className="safe-bottom absolute inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingLeft: "max(12px, env(safe-area-inset-left))", paddingRight: "max(12px, env(safe-area-inset-right))" }}
    >
      <input
        type="range"
        min={0}
        max={1000}
        value={value}
        aria-label={t.reader.page}
        onChange={(e) => setDrag(+e.target.value)}
        onPointerUp={commit}
        onKeyUp={commit}
        onTouchEnd={commit}
      />
      <div className="-mt-1 flex items-center justify-between text-xs text-muted">
        <span>
          {t.reader.page} {info.page} {t.reader.of} {info.total}
        </span>
        <span>{shownPct}%</span>
        <span>
          {formatLeft(minutesLeft)} {t.reader.left}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-around pb-1">
        <button className="btn-icon" onClick={onToc} aria-label={t.reader.toc}>
          <List size={22} />
        </button>
        <button className="btn-icon" onClick={onBookmark} aria-label={bookmarked ? t.reader.removeBookmark : t.reader.addBookmark}>
          <Bookmark size={22} fill={bookmarked ? "currentColor" : "none"} />
        </button>
        <button className="btn-icon" onClick={onNotes} aria-label={t.reader.notes}>
          <NotebookPen size={22} />
        </button>
        {canReflow && (
          <button className="btn-icon" onClick={onMode} aria-label={t.reader.mode} title={mode === "reflow" ? t.reader.modePage : t.reader.modeReflow}>
            {mode === "reflow" ? <FileText size={22} /> : <BookOpen size={22} />}
          </button>
        )}
        <button className="btn-icon" onClick={onFullscreen} aria-label={t.reader.fullscreen}>
          <Maximize size={21} />
        </button>
      </div>
    </div>
  );
}
