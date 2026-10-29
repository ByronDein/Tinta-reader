import { cpSync, existsSync, mkdirSync } from "node:fs";
const root = "node_modules/pdfjs-dist";
if (existsSync(root)) {
  mkdirSync("public/pdfjs", { recursive: true });
  cpSync(`${root}/build/pdf.worker.min.mjs`, "public/pdf.worker.min.mjs");
  for (const d of ["wasm", "cmaps", "standard_fonts"]) {
    if (existsSync(`${root}/${d}`)) cpSync(`${root}/${d}`, `public/pdfjs/${d}`, { recursive: true });
  }
}
