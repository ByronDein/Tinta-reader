import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Annotation, Block, Book, Progress, StatRow } from "./types";
import type { ReaderSettings } from "./settings";

interface Schema extends DBSchema {
  books: { key: string; value: Book };
  files: { key: string; value: { bookId: string; blob: Blob } };
  blocks: { key: string; value: { bookId: string; blocks: Block[] } };
  progress: { key: string; value: Progress };
  settings: { key: string; value: { key: string; value: Partial<ReaderSettings> } };
  annotations: { key: string; value: Annotation; indexes: { bookId: string } };
  stats: { key: string; value: StatRow };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db() {
  if (!dbp) {
    dbp = openDB<Schema>("pdf-reader", 1, {
      upgrade(d) {
        d.createObjectStore("books", { keyPath: "id" });
        d.createObjectStore("files", { keyPath: "bookId" });
        d.createObjectStore("blocks", { keyPath: "bookId" });
        d.createObjectStore("progress", { keyPath: "bookId" });
        d.createObjectStore("settings", { keyPath: "key" });
        d.createObjectStore("annotations", { keyPath: "id" }).createIndex("bookId", "bookId");
        d.createObjectStore("stats", { keyPath: "date" });
        d.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbp;
}

export async function requestPersist() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
}

// Libros
export const listBooks = async () => (await db()).getAll("books");
export const getBook = async (id: string) => (await db()).get("books", id);
export const putBook = async (b: Book) => void (await db()).put("books", b);
export const getFile = async (id: string) => (await (await db()).get("files", id))?.blob;
export const putFile = async (bookId: string, blob: Blob) => void (await (await db()).put("files", { bookId, blob }));
export const getBlocks = async (id: string) => (await (await db()).get("blocks", id))?.blocks;
export const putBlocks = async (bookId: string, blocks: Block[]) =>
  void (await (await db()).put("blocks", { bookId, blocks }));

export async function deleteBook(id: string) {
  const d = await db();
  const tx = d.transaction(["books", "files", "blocks", "progress", "settings", "annotations"], "readwrite");
  await Promise.all([
    tx.objectStore("books").delete(id),
    tx.objectStore("files").delete(id),
    tx.objectStore("blocks").delete(id),
    tx.objectStore("progress").delete(id),
    tx.objectStore("settings").delete(id),
  ]);
  const idx = tx.objectStore("annotations").index("bookId");
  for await (const c of idx.iterate(id)) c.delete();
  await tx.done;
}

// Progreso
export const getProgress = async (id: string) => (await db()).get("progress", id);
export const putProgress = async (p: Progress) => void (await db()).put("progress", p);
export const listProgress = async () => (await db()).getAll("progress");

// Ajustes ("global" o id de libro)
export async function getSettings(key: string) {
  return (await (await db()).get("settings", key))?.value;
}
export async function putSettings(key: string, value: Partial<ReaderSettings>) {
  await (await db()).put("settings", { key, value });
}
export async function deleteSettings(key: string) {
  await (await db()).delete("settings", key);
}

// Anotaciones
export const listAnnotations = async (bookId: string) =>
  (await db()).getAllFromIndex("annotations", "bookId", bookId);
export const putAnnotation = async (a: Annotation) => void (await db()).put("annotations", a);
export const deleteAnnotation = async (id: string) => void (await db()).delete("annotations", id);

// Estadísticas
export const listStats = async () => (await db()).getAll("stats");
export async function addReadingSeconds(date: string, seconds: number, bookId: string) {
  const d = await db();
  const tx = d.transaction("stats", "readwrite");
  const row = (await tx.store.get(date)) ?? { date, seconds: 0, bookIds: [] };
  row.seconds += seconds;
  if (!row.bookIds.includes(bookId)) row.bookIds.push(bookId);
  await tx.store.put(row);
  await tx.done;
}

// Meta
export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get("meta", key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await (await db()).put("meta", { key, value });
}

// Copia de seguridad (todo excepto PDF/bloques/portadas)
export async function dumpBackup() {
  const d = await db();
  const books = (await d.getAll("books")).map(({ coverBlob, ...rest }) => {
    void coverBlob;
    return rest;
  });
  return {
    app: "pdf-reader",
    version: 1,
    exportedAt: Date.now(),
    books,
    progress: await d.getAll("progress"),
    settings: await d.getAll("settings"),
    annotations: await d.getAll("annotations"),
    stats: await d.getAll("stats"),
  };
}
