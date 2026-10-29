/// <reference lib="webworker" />
// Reconstruye párrafos fuera del hilo principal. pdf.js extrae el texto en su propio worker;
// aquí se agrupa en líneas, columnas, párrafos y títulos.
import { pageToLines, type PageLines, type RawItem } from "@/lib/reflow/extract";
import { buildBlocks } from "@/lib/reflow/paragraphs";
import type { Block } from "@/lib/types";

export type WorkerIn =
  | { type: "page"; n: number; items: RawItem[]; styles?: Record<string, { fontFamily?: string }>; view: number[] }
  | { type: "finish" };
export type WorkerOut = { type: "done"; blocks: Block[]; chars: number } | { type: "error"; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const pages: PageLines[] = [];
let chars = 0;

ctx.onmessage = (e: MessageEvent<WorkerIn>) => {
  try {
    const m = e.data;
    if (m.type === "page") {
      const pl = pageToLines(m.items, m.styles, m.view, m.n);
      for (const l of pl.lines) chars += l.text.length;
      pages.push(pl);
    } else {
      const out: WorkerOut = { type: "done", blocks: buildBlocks(pages), chars };
      ctx.postMessage(out);
    }
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies WorkerOut);
  }
};
