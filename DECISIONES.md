# Decisiones
- Next.js 16 / Tailwind 4 / TS instalados en sus últimas versiones estables; scaffolding manual (carpeta no vacía).
- PWA: service worker escrito a mano en `public/sw.js` (Serwist/next-pwa requieren webpack; Next 16 usa Turbopack). Cache-first para estáticos, fuentes y worker de pdf.js.
- Los assets de pdf.js (worker, wasm, cmaps, standard_fonts) se copian a `public/` en `postinstall`.
- pdf.js (API) no corre en un Web Worker propio (necesita window/document): getTextContent se llama en el hilo principal (pdf.js ya parsea en su worker) y los párrafos se reconstruyen en `workers/extract.worker.ts`.
- El PDF original se guarda en IndexedDB como Blob; el reflow se calcula una vez en un Web Worker y se cachea.
- Tema "Personalizado" y "Automático" son opciones de `themeId` adicionales.
- Marcadores/subrayados en modo página original se anclan por número de página (blockIndex = página-1).
- Ruta del lector: `/read?id=` (estática) en vez de `/read/[id]`, para que funcione offline con el service worker.
- Modo página original: solo marcadores (los subrayados y notas se hacen en modo lectura).
