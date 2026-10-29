"use client";
import { create } from "zustand";
import { deleteBook, listBooks, listProgress } from "@/lib/db";
import { importPdf, isPdf } from "@/lib/import";
import type { Book, Progress } from "@/lib/types";
import { t } from "@/lib/i18n/es";

export interface Job {
  key: string;
  name: string;
  pct: number;
  error?: string;
}

interface State {
  books: Book[];
  progress: Record<string, Progress>;
  loaded: boolean;
  jobs: Job[];
  load: () => Promise<void>;
  addFiles: (files: File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useLibrary = create<State>((set, get) => ({
  books: [],
  progress: {},
  loaded: false,
  jobs: [],
  async load() {
    const [books, progress] = await Promise.all([listBooks(), listProgress()]);
    set({ books, progress: Object.fromEntries(progress.map((p) => [p.bookId, p])), loaded: true });
  },
  async addFiles(files) {
    const patch = (key: string, p: Partial<Job>) =>
      set((s) => ({ jobs: s.jobs.map((j) => (j.key === key ? { ...j, ...p } : j)) }));
    for (const f of files) {
      const key = `${f.name}-${Math.random().toString(36).slice(2)}`;
      if (!isPdf(f)) {
        set((s) => ({ jobs: [...s.jobs, { key, name: f.name, pct: 0, error: t.library.notPdf }] }));
        continue;
      }
      set((s) => ({ jobs: [...s.jobs, { key, name: f.name, pct: 0 }] }));
      try {
        await importPdf(f, (pct) => patch(key, { pct }));
        await get().load();
        set((s) => ({ jobs: s.jobs.filter((j) => j.key !== key) }));
      } catch (err) {
        console.error(err);
        patch(key, { error: t.library.importError });
      }
    }
  },
  async remove(id) {
    await deleteBook(id);
    await get().load();
  },
}));
