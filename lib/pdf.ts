import type { PDFDocumentProxy } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");
let lib: Promise<PdfJs> | null = null;

/** Carga pdf.js solo en el cliente, con el worker servido localmente. */
export function loadPdfJs(): Promise<PdfJs> {
  if (!lib) {
    lib = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return m;
    });
  }
  return lib;
}

export function pdfAssetOptions(origin: string) {
  return {
    wasmUrl: `${origin}/pdfjs/wasm/`,
    cMapUrl: `${origin}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${origin}/pdfjs/standard_fonts/`,
  };
}

export interface OpenedPdf {
  pdf: PDFDocumentProxy;
  destroy: () => void;
}

/** Abre un PDF desde un Blob usando una URL de objeto (lectura por rangos, sin copiar todo a memoria). */
export async function openPdf(blob: Blob): Promise<OpenedPdf> {
  const pdfjs = await loadPdfJs();
  const url = URL.createObjectURL(blob);
  const task = pdfjs.getDocument({ url, ...pdfAssetOptions(location.origin) });
  const pdf = await task.promise;
  return {
    pdf,
    destroy: () => {
      void task.destroy();
      URL.revokeObjectURL(url);
    },
  };
}

/** Miniatura JPEG de la primera página. */
export async function renderCover(pdf: PDFDocumentProxy, width = 320): Promise<Blob | undefined> {
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  page.cleanup();
  return new Promise((res) => canvas.toBlob((b) => res(b ?? undefined), "image/jpeg", 0.8));
}
