"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, DatabaseBackup, Loader2, Plus, Search, X } from "lucide-react";
import { useLibrary } from "@/store/library";
import { getMeta, setMeta } from "@/lib/db";
import { t } from "@/lib/i18n/es";
import { BookCard } from "./BookCard";
import { Welcome } from "./Welcome";
import { Stats } from "./Stats";
import { BackupMenu } from "./BackupMenu";
import type { Book } from "@/lib/types";

type Sort = "recent" | "title" | "added";

export function Library() {
  const { books, progress, loaded, jobs, load, addFiles, remove } = useLibrary();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [dragging, setDragging] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [stats, setStats] = useState(false);
  const [backup, setBackup] = useState(false);
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void load();
    void getMeta<boolean>("welcomeSeen").then((v) => setWelcome(!v));
  }, [load]);

  useEffect(() => {
    let depth = 0;
    const over = (e: DragEvent) => e.preventDefault();
    const enter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        depth++;
        setDragging(true);
      }
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) void addFiles(files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = books.filter((b) => !q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q));
    list.sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "es")
        : sort === "added"
          ? b.addedAt - a.addedAt
          : (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt),
    );
    return [
      { title: t.library.reading, items: list.filter((b) => b.status === "reading") },
      { title: t.library.unread, items: list.filter((b) => b.status === "new") },
      { title: t.library.done, items: list.filter((b) => b.status === "done") },
    ].filter((g) => g.items.length);
  }, [books, query, sort]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-10">
      <header className="safe-top sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between pt-3">
          <h1 className="text-2xl font-semibold">{t.library.title}</h1>
          <div className="flex items-center gap-1">
            <button className="btn-icon" aria-label={t.library.stats} onClick={() => setStats(true)}>
              <BarChart3 size={22} />
            </button>
            <button className="btn-icon" aria-label={t.library.backup} onClick={() => setBackup(true)}>
              <DatabaseBackup size={22} />
            </button>
            <button className="btn btn-primary" onClick={() => input.current?.click()}>
              <Plus size={18} /> <span className="whitespace-nowrap">{t.library.addShort}</span>
            </button>
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void addFiles(files);
          }}
        />
        <div className="mt-3 flex gap-2">
          <label className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-3 text-muted" />
            <input
              className="field pl-10"
              placeholder={t.library.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            className="field !w-auto"
            aria-label={t.library.sort}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="recent">{t.library.sortRecent}</option>
            <option value="title">{t.library.sortTitle}</option>
            <option value="added">{t.library.sortAdded}</option>
          </select>
        </div>
      </header>

      {jobs.length > 0 && (
        <div className="mt-2 space-y-2">
          {jobs.map((j) => (
            <div key={j.key} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {j.error ? `${j.name} — ${j.error}` : `${t.library.importing} ${j.name}`}
                </span>
                {j.error ? (
                  <button
                    className="btn-icon !min-h-8 !min-w-8"
                    onClick={() => useLibrary.setState((s) => ({ jobs: s.jobs.filter((x) => x.key !== j.key) }))}
                    aria-label={t.reader.close}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <Loader2 size={16} className="animate-spin" />
                )}
              </div>
              {!j.error && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-fg transition-all" style={{ width: `${Math.round(j.pct * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loaded && !books.length && !jobs.length && (
        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <p className="max-w-xs text-muted">{t.library.empty}</p>
          <button className="btn btn-primary" onClick={() => input.current?.click()}>
            <Plus size={18} /> {t.library.add}
          </button>
        </div>
      )}
      {loaded && books.length > 0 && !groups.length && <p className="mt-10 text-center text-muted">{t.library.noResults}</p>}

      {groups.map((g) => (
        <section key={g.title} className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{g.title}</h2>
          <div className="grid grid-cols-2 gap-4 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5">
            {g.items.map((b) => (
              <BookCard key={b.id} book={b} percent={progress[b.id]?.percent ?? 0} onDelete={() => setToDelete(b)} />
            ))}
          </div>
        </section>
      ))}

      {dragging && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center rounded-3xl border-2 border-dashed border-fg bg-bg/90 text-xl font-medium">
          {t.library.drop}
        </div>
      )}
      {welcome && (
        <Welcome
          onStart={() => {
            setWelcome(false);
            void setMeta("welcomeSeen", true);
          }}
        />
      )}
      {stats && <Stats onClose={() => setStats(false)} />}
      {backup && (
        <BackupMenu
          onClose={() => setBackup(false)}
          onImported={() => {
            void load();
          }}
        />
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setToDelete(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-bg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{toDelete.title}</h3>
            <p className="mt-2 text-sm text-muted">{t.library.deleteConfirm}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setToDelete(null)}>
                {t.library.cancel}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  void remove(toDelete.id);
                  setToDelete(null);
                }}
              >
                {t.library.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
