import type { PDFDocumentProxy } from "pdfjs-dist";
import type { WorkerIn, WorkerOut } from "@/workers/extract.worker";
import type { RawItem } from "./reflow/extract";
import { getBook, putBlocks, putBook, putFile } from "./db";
import { openPdf, renderCover } from "./pdf";
import type { Block, Book, TocItem } from "./types";

export const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

async function fileId(f: File) {
  const head = await f.slice(0, 256 * 1024).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", head);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);
  return `${hex}-${f.size.toString(36)}`;
}

/** pdf.js lee cada página en su worker; los párrafos se reconstruyen en un Web Worker propio. */
async function extractBlocks(pdf: PDFDocumentProxy, onProgress: (pct: number) => void) {
  const worker = new Worker(new URL("../workers/extract.worker.ts", import.meta.url), { type: "module" });
  const done = new Promise<Extract<WorkerOut, { type: "done" }>>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerOut>) => (e.data.type === "done" ? resolve(e.data) : reject(new Error(e.data.message)));
    worker.onerror = (e) => reject(new Error(e.message || "worker"));
  });
  try {
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const items: RawItem[] = [];
      for (const it of tc.items) {
        if ("str" in it && it.str) {
          items.push({ str: it.str, transform: it.transform, width: it.width, height: it.height, fontName: it.fontName });
        }
      }
      worker.postMessage({ type: "page", n: i, items, styles: tc.styles, view: page.view } satisfies WorkerIn);
      page.cleanup();
      onProgress(i / total);
    }
    worker.postMessage({ type: "finish" } satisfies WorkerIn);
    return await done;
  } finally {
    worker.terminate();
  }
}

interface OutlineNode {
  title: string;
  dest: string | unknown[] | null;
  items?: OutlineNode[];
}

async function buildToc(pdf: PDFDocumentProxy, blocks: Block[]): Promise<TocItem[]> {
  const toc: TocItem[] = [];
  const firstBlockOfPage = (page: number) => {
    const idx = blocks.findIndex((b) => b.page >= page);
    return idx < 0 ? Math.max(0, blocks.length - 1) : idx;
  };
  try {
    const outline = (await pdf.getOutline()) as OutlineNode[] | null;
    const walk = async (nodes: OutlineNode[], level: number) => {
      for (const n of nodes) {
        if (toc.length >= 500) return;
        let page = -1;
        try {
          const dest = typeof n.dest === "string" ? await pdf.getDestination(n.dest) : n.dest;
          const ref = dest?.[0];
          if (ref && typeof ref === "object") page = (await pdf.getPageIndex(ref as never)) + 1;
          else if (typeof ref === "number") page = ref + 1;
        } catch {}
        if (page > 0 && n.title.trim()) toc.push({ title: n.title.trim(), page, level, blockIndex: blocks.length ? firstBlockOfPage(page) : -1 });
        if (n.items?.length && level < 3) await walk(n.items, level + 1);
      }
    };
    if (outline?.length) await walk(outline, 0);
  } catch {}
  if (!toc.length) {
    blocks.forEach((b, i) => {
      if ((b.type === "h1" || b.type === "h2") && toc.length < 300) {
        toc.push({ title: b.text, page: b.page, level: b.type === "h1" ? 0 : 1, blockIndex: i });
      }
    });
  }
  return toc;
}

/** Importa un PDF: guarda el archivo, extrae el texto y genera la portada. */
export async function importPdf(file: File, onProgress: (pct: number) => void): Promise<Book> {
  const id = await fileId(file);
  const existing = await getBook(id);
  if (existing) return existing;
  onProgress(0.02);
  await putFile(id, file);
  const opened = await openPdf(file);
  try {
    const pdf = opened.pdf;
    const res = await extractBlocks(pdf, (p) => onProgress(0.05 + p * 0.85));
    const pageCount = pdf.numPages;
    const hasText = res.chars / Math.max(1, pageCount) >= 20;
    const blocks = hasText ? res.blocks : [];
    const toc = await buildToc(pdf, blocks);
    let title: string | undefined;
    let author: string | undefined;
    try {
      const info = (await pdf.getMetadata()).info as Record<string, unknown>;
      if (typeof info?.Title === "string" && info.Title.trim()) title = info.Title.trim();
      if (typeof info?.Author === "string" && info.Author.trim()) author = info.Author.trim();
    } catch {}
    let cover: Blob | undefined;
    try {
      cover = await renderCover(pdf);
    } catch {}
    await putBlocks(id, blocks);
    const book: Book = {
      id,
      title: title ?? file.name.replace(/\.pdf$/i, ""),
      author,
      size: file.size,
      pageCount,
      coverBlob: cover,
      hasText,
      blockCount: blocks.length,
      toc,
      addedAt: Date.now(),
      lastOpenedAt: 0,
      status: "new",
    };
    await putBook(book);
    onProgress(1);
    return book;
  } finally {
    opened.destroy();
  }
}
