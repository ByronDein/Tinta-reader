import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeBus, db, deleteBookLocal, getBook, getFile, getMeta, getProgress, listBooks, listProgress, setMeta } from "./db";
import { supabase } from "./supabase";
import type { Annotation, Book, Progress } from "./types";
import { useSettingsStore } from "@/store/settings";

export interface CloudBook {
  id: string;
  title: string;
  author?: string;
  size: number;
  pageCount: number;
}

interface SyncState {
  status: "idle" | "syncing" | "error";
  step: string;
  error: string;
  lastAt: number;
  /** sube cada vez que termina una sincronización (para recargar la biblioteca) */
  version: number;
  cloudOnly: CloudBook[];
}

export const useSync = create<SyncState>(() => ({
  status: "idle",
  step: "",
  error: "",
  lastAt: 0,
  version: 0,
  cloudOnly: [],
}));
const set = useSync.setState;

interface BookRow {
  id: string;
  title: string;
  author: string | null;
  size: number;
  page_count: number;
  added_at: number;
  has_file: boolean;
  deleted: boolean;
  updated_at: number;
}
interface ProgressRow {
  user_id?: string;
  book_id: string;
  mode: Progress["mode"];
  block_index: number;
  char_offset: number;
  pdf_page: number;
  percent: number;
  updated_at: number;
}
interface AnnotationRow {
  id: string;
  book_id: string;
  data: Annotation;
  deleted: boolean;
  updated_at: number;
}
interface SettingsRow {
  key: string;
  value: Record<string, unknown>;
  updated_at: number;
}

const errText = (e: unknown) => {
  if (!e || typeof e !== "object") return String(e ?? "");
  const x = e as { message?: string; statusCode?: string | number; status?: number };
  return `${x.message ?? ""} ${x.statusCode ?? x.status ?? ""}`.trim();
};

function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return (res.data ?? []) as T;
}

async function session() {
  const c = supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? { c, uid: data.session.user.id } : null;
}

const statusOf = (percent: number): Book["status"] => (percent >= 0.985 ? "done" : percent > 0.002 ? "reading" : "new");

async function applyProgress(r: ProgressRow) {
  const d = await db();
  await d.put("progress", {
    bookId: r.book_id,
    mode: r.mode,
    blockIndex: r.block_index,
    charOffset: r.char_offset,
    pdfPage: r.pdf_page,
    percent: r.percent,
    updatedAt: r.updated_at,
  });
  const b = await getBook(r.book_id);
  if (b) {
    const status = statusOf(r.percent);
    await d.put("books", {
      ...b,
      status,
      lastOpenedAt: Math.max(b.lastOpenedAt, r.updated_at),
      finishedAt: status === "done" ? (b.finishedAt ?? r.updated_at) : b.finishedAt,
    });
  }
}

const toProgressRow = (uid: string, p: Progress): ProgressRow => ({
  user_id: uid,
  book_id: p.bookId,
  mode: p.mode,
  block_index: p.blockIndex,
  char_offset: p.charOffset,
  pdf_page: p.pdfPage,
  percent: p.percent,
  updated_at: p.updatedAt,
});

// ---------------------------------------------------------------------------
// Pasos de la sincronización

async function pushDeletions(c: SupabaseClient, uid: string) {
  const delBooks = (await getMeta<string[]>("delBooks")) ?? [];
  for (const id of delBooks) {
    if (await getBook(id)) continue; // se volvió a importar: no hay que borrarlo
    must(
      await c
        .from("books")
        .upsert(
          { user_id: uid, id, title: "", has_file: false, deleted: true, updated_at: Date.now() },
          { onConflict: "user_id,id" },
        ),
    );
    await c.storage.from("books").remove([`${uid}/${id}.pdf`]);
    must(await c.from("progress").delete().eq("book_id", id));
    must(await c.from("annotations").delete().eq("book_id", id));
  }
  if (delBooks.length) await setMeta("delBooks", []);
}

async function upload(c: SupabaseClient, uid: string, b: Book) {
  const blob = await getFile(b.id);
  if (!blob) return false;
  set({ step: b.title });
  const { error } = await c.storage
    .from("books")
    .upload(`${uid}/${b.id}.pdf`, blob, { contentType: "application/pdf", upsert: false });
  if (!error) return true;
  const m = errText(error);
  if (/already exists|duplicate|409/i.test(m)) return true;
  if (/size|exceed|too large|413/i.test(m)) {
    const cur = (await getMeta<string[]>("noUpload")) ?? [];
    if (!cur.includes(b.id)) await setMeta("noUpload", [...cur, b.id]);
  } else {
    console.warn("upload", m);
  }
  return false;
}

async function syncBooks(c: SupabaseClient, uid: string) {
  const rows = must(await c.from("books").select("*")) as BookRow[];
  const cloud = new Map(rows.map((r) => [r.id, r]));
  const noUpload = new Set((await getMeta<string[]>("noUpload")) ?? []);
  const keep = new Set<string>();
  for (const b of await listBooks()) {
    const r = cloud.get(b.id);
    if (r?.deleted && r.updated_at >= b.addedAt) {
      await deleteBookLocal(b.id); // se eliminó en otro dispositivo
      continue;
    }
    keep.add(b.id);
    const live = !!r && !r.deleted;
    let hasFile = live && r.has_file;
    if (!hasFile && !noUpload.has(b.id)) hasFile = await upload(c, uid, b);
    if (!live || hasFile !== r.has_file) {
      must(
        await c.from("books").upsert(
          {
            user_id: uid,
            id: b.id,
            title: b.title,
            author: b.author ?? null,
            size: b.size,
            page_count: b.pageCount,
            added_at: b.addedAt,
            has_file: hasFile,
            deleted: false,
            updated_at: Date.now(),
          },
          { onConflict: "user_id,id" },
        ),
      );
    }
  }
  const cloudOnly: CloudBook[] = rows
    .filter((r) => !r.deleted && r.has_file && !keep.has(r.id))
    .map((r) => ({ id: r.id, title: r.title, author: r.author ?? undefined, size: r.size, pageCount: r.page_count }));
  set({ cloudOnly });
}

async function syncProgress(c: SupabaseClient, uid: string) {
  const rows = must(await c.from("progress").select("*")) as ProgressRow[];
  const cloud = new Map(rows.map((r) => [r.book_id, r]));
  const ids = new Set((await listBooks()).map((b) => b.id));
  const up: ProgressRow[] = [];
  const seen = new Set<string>();
  for (const p of await listProgress()) {
    if (!ids.has(p.bookId)) continue;
    seen.add(p.bookId);
    const r = cloud.get(p.bookId);
    if (!r || p.updatedAt > r.updated_at) up.push(toProgressRow(uid, p));
    else if (r.updated_at > p.updatedAt) await applyProgress(r);
  }
  for (const r of rows) if (!seen.has(r.book_id) && ids.has(r.book_id)) await applyProgress(r);
  if (up.length) must(await c.from("progress").upsert(up, { onConflict: "user_id,book_id" }));
}

async function syncAnnotations(c: SupabaseClient, uid: string) {
  const rows = must(await c.from("annotations").select("*")) as AnnotationRow[];
  const cloud = new Map(rows.map((r) => [r.id, r]));
  const d = await db();
  const ids = new Set((await listBooks()).map((b) => b.id));
  const local = (await d.getAll("annotations")).filter((a) => ids.has(a.bookId));
  const localMap = new Map(local.map((a) => [a.id, a]));
  const stamp = (a: Annotation) => a.updatedAt ?? a.createdAt;
  const up: Record<string, unknown>[] = [];

  const dels = (await getMeta<string[]>("delAnn")) ?? [];
  const deleting = new Set(dels);
  for (const id of dels) {
    const r = cloud.get(id);
    if (r && !r.deleted) {
      up.push({ user_id: uid, id, book_id: r.book_id, data: {}, deleted: true, updated_at: Date.now() });
    }
  }
  for (const a of local) {
    const r = cloud.get(a.id);
    if (!r || stamp(a) > r.updated_at) {
      up.push({ user_id: uid, id: a.id, book_id: a.bookId, data: a, deleted: false, updated_at: stamp(a) });
    } else if (r.updated_at > stamp(a)) {
      if (r.deleted) await d.delete("annotations", a.id);
      else await d.put("annotations", { ...r.data, id: a.id, bookId: r.book_id, updatedAt: r.updated_at });
    }
  }
  for (const r of rows) {
    if (r.deleted || localMap.has(r.id) || deleting.has(r.id) || !ids.has(r.book_id)) continue;
    await d.put("annotations", { ...r.data, id: r.id, bookId: r.book_id, updatedAt: r.updated_at });
  }
  for (let i = 0; i < up.length; i += 200) {
    must(await c.from("annotations").upsert(up.slice(i, i + 200), { onConflict: "user_id,id" }));
  }
  if (dels.length) await setMeta("delAnn", []);
}

async function syncSettings(c: SupabaseClient, uid: string) {
  const rows = must(await c.from("settings").select("*")) as SettingsRow[];
  const cloud = new Map(rows.map((r) => [r.key, r]));
  const d = await db();
  const keys = ["global", ...(await listBooks()).map((b) => b.id)];
  const up: Record<string, unknown>[] = [];
  let applied = false;
  for (const key of keys) {
    const value = (await d.get("settings", key))?.value;
    const at = (await getMeta<number>(`sa:${key}`)) ?? 0;
    const r = cloud.get(key);
    if (value && at && (!r || at > r.updated_at)) {
      up.push({ user_id: uid, key, value, updated_at: at });
    } else if (r && r.updated_at > at) {
      await d.put("settings", { key, value: r.value });
      await setMeta(`sa:${key}`, r.updated_at);
      applied = true;
    }
  }
  if (up.length) must(await c.from("settings").upsert(up, { onConflict: "user_id,key" }));
  if (applied) {
    const st = useSettingsStore.getState();
    if (st.loaded) {
      const bookId = st.bookId;
      await st.load();
      if (bookId) await st.loadBook(bookId);
    }
  }
}

// ---------------------------------------------------------------------------
// API pública

let running: Promise<void> | null = null;
let again = false;

async function run() {
  const s = await session();
  if (!s) return;
  const { c, uid } = s;
  set({ status: "syncing", step: "", error: "" });
  try {
    await pushDeletions(c, uid);
    await syncBooks(c, uid);
    await syncProgress(c, uid);
    await syncAnnotations(c, uid);
    await syncSettings(c, uid);
    set((st) => ({ status: "idle", step: "", lastAt: Date.now(), version: st.version + 1 }));
  } catch (e) {
    console.warn("sync", e);
    set({ status: "error", step: "", error: errText(e) || "Error de sincronización" });
  }
}

/** Sincroniza todo con la nube. No hace nada si no hay sesión. Si ya hay una en curso, encadena otra al terminar. */
export function syncAll(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await run();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

let soon: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync() {
  clearTimeout(soon);
  soon = setTimeout(() => void syncAll(), 5000);
}

let pending: Progress | null = null;
let progressTimer: ReturnType<typeof setTimeout> | undefined;

/** Envía el progreso del libro abierto (con retraso para no saturar la red). */
export function pushProgress(p: Progress) {
  pending = p;
  clearTimeout(progressTimer);
  progressTimer = setTimeout(() => void flushProgress(), 4000);
}

export async function flushProgress() {
  clearTimeout(progressTimer);
  const p = pending;
  pending = null;
  if (!p) return;
  try {
    const s = await session();
    if (!s) return;
    must(await s.c.from("progress").upsert(toProgressRow(s.uid, p), { onConflict: "user_id,book_id" }));
  } catch (e) {
    console.warn("progress", e);
  }
}

/** Al abrir un libro: si otro dispositivo leyó más recientemente, usa esa posición. */
export async function pullProgress(bookId: string) {
  try {
    const s = await session();
    if (!s) return;
    const { data } = await s.c.from("progress").select("*").eq("book_id", bookId).maybeSingle();
    if (!data) return;
    const local = await getProgress(bookId);
    if (!local || (data as ProgressRow).updated_at > local.updatedAt) await applyProgress(data as ProgressRow);
  } catch (e) {
    console.warn("pullProgress", e);
  }
}

export async function downloadBook(b: CloudBook): Promise<File> {
  const s = await session();
  if (!s) throw new Error("Sin sesión");
  const { data, error } = await s.c.storage.from("books").download(`${s.uid}/${b.id}.pdf`);
  if (error || !data) throw error ?? new Error("No se pudo descargar");
  return new File([data], `${b.title || "libro"}.pdf`, { type: "application/pdf" });
}

/** Borra los archivos y la cuenta en la nube. Los libros locales de este dispositivo se conservan. */
export async function deleteAccount() {
  const s = await session();
  if (!s) throw new Error("Sin sesión");
  const { c, uid } = s;
  for (let i = 0; i < 20; i++) {
    const { data } = await c.storage.from("books").list(uid, { limit: 1000 });
    if (!data?.length) break;
    const { error } = await c.storage.from("books").remove(data.map((f) => `${uid}/${f.name}`));
    if (error) throw error;
  }
  must(await c.rpc("delete_my_account"));
  await c.auth.signOut({ scope: "local" });
  set({ cloudOnly: [], status: "idle", error: "", lastAt: 0 });
}

export function initSync() {
  changeBus.fn = scheduleSync;
  const onHide = () => {
    if (document.visibilityState === "hidden") void flushProgress();
  };
  let last = 0;
  const onFocus = () => {
    if (Date.now() - last < 60_000) return;
    last = Date.now();
    void syncAll();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("online", onFocus);
  window.addEventListener("focus", onFocus);
  return () => {
    changeBus.fn = null;
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("pagehide", onHide);
    window.removeEventListener("online", onFocus);
    window.removeEventListener("focus", onFocus);
  };
}
