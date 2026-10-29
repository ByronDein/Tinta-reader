import { db, dumpBackup, getBook, putBook } from "./db";
import type { Annotation, Progress, StatRow } from "./types";

export async function exportBackup() {
  const data = await dumpBackup();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lector-pdf-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Restaura progreso, notas, marcadores y ajustes. Los datos de libros solo se aplican si el PDF ya está en la biblioteca. */
export async function importBackup(file: File): Promise<boolean> {
  let data: {
    app?: string;
    books?: { id: string; status: "new" | "reading" | "done"; finishedAt?: number }[];
    progress?: Progress[];
    settings?: { key: string; value: Record<string, unknown> }[];
    annotations?: Annotation[];
    stats?: StatRow[];
  };
  try {
    data = JSON.parse(await file.text());
  } catch {
    return false;
  }
  if (data?.app !== "pdf-reader") return false;
  const d = await db();
  const local = new Set((await d.getAllKeys("books")) as string[]);
  for (const b of data.books ?? []) {
    if (!local.has(b.id)) continue;
    const cur = await getBook(b.id);
    if (cur) await putBook({ ...cur, status: b.status, finishedAt: b.finishedAt });
  }
  for (const p of data.progress ?? []) if (local.has(p.bookId)) await d.put("progress", p);
  for (const s of data.settings ?? []) if (s.key === "global" || local.has(s.key)) await d.put("settings", s);
  for (const a of data.annotations ?? []) if (local.has(a.bookId)) await d.put("annotations", a);
  for (const s of data.stats ?? []) {
    const cur = await d.get("stats", s.date);
    if (!cur || cur.seconds < s.seconds) await d.put("stats", s);
  }
  return true;
}
