"use client";
import { create } from "zustand";
import { useMemo } from "react";
import { DEFAULT_SETTINGS, type ReaderSettings } from "@/lib/settings";
import { applyTheme } from "@/lib/themes";
import { deleteSettings, getSettings, putSettings } from "@/lib/db";

interface State {
  global: ReaderSettings;
  book: Partial<ReaderSettings> | null;
  bookId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  loadBook: (id: string | null) => Promise<void>;
  update: (patch: Partial<ReaderSettings>, onlyBook: boolean) => void;
  reset: (onlyBook: boolean) => void;
}

const merged = (s: Pick<State, "global" | "book">): ReaderSettings => ({ ...s.global, ...(s.book ?? {}) });

export const useSettingsStore = create<State>((set, get) => ({
  global: DEFAULT_SETTINGS,
  book: null,
  bookId: null,
  loaded: false,
  async load() {
    const saved = await getSettings("global");
    set({ global: { ...DEFAULT_SETTINGS, ...(saved ?? {}) }, loaded: true });
    applyTheme(merged(get()));
  },
  async loadBook(id) {
    const book = id ? ((await getSettings(id)) ?? null) : null;
    set({ bookId: id, book: book && Object.keys(book).length ? book : null });
    applyTheme(merged(get()));
  },
  update(patch, onlyBook) {
    const s = get();
    if (onlyBook && s.bookId) {
      const book = { ...(s.book ?? {}), ...patch };
      set({ book });
      void putSettings(s.bookId, book);
    } else {
      const global = { ...s.global, ...patch };
      // un ajuste global sustituye el override del libro para esas claves
      const book = s.book ? { ...s.book } : null;
      if (book) for (const k of Object.keys(patch)) delete (book as Record<string, unknown>)[k];
      set({ global, book: book && Object.keys(book).length ? book : null });
      void putSettings("global", global);
      if (s.bookId && book) void putSettings(s.bookId, book);
    }
    applyTheme(merged(get()));
  },
  reset(onlyBook) {
    const s = get();
    if (onlyBook && s.bookId) {
      set({ book: null });
      void deleteSettings(s.bookId);
    } else {
      set({ global: DEFAULT_SETTINGS, book: null });
      void putSettings("global", DEFAULT_SETTINGS);
      if (s.bookId) void deleteSettings(s.bookId);
    }
    applyTheme(merged(get()));
  },
}));

export function useSettings(): ReaderSettings {
  const global = useSettingsStore((s) => s.global);
  const book = useSettingsStore((s) => s.book);
  return useMemo(() => ({ ...global, ...(book ?? {}) }), [global, book]);
}
