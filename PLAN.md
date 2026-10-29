# PLAN — Lector PDF tipo Kindle (100% navegador)

Next.js App Router + TS + Tailwind · pdfjs-dist (worker local) · idb · zustand · lucide-react · Serwist (PWA offline) · @fontsource. Sin backend, sin rutas API, sin analytics. Deploy: Vercel Hobby.

## Estructura
```
app/            layout.tsx (script tema inline), page.tsx (biblioteca), read/[id]/page.tsx (lector), sw.ts, globals.css
components/     library/*, reader/* (ReflowView, PageView, TopBar, BottomBar, SettingsPanel, TocPanel, SearchPanel, AnnotationsPanel), ui/*
lib/            db.ts, pdf.ts, reflow/ (extract.ts, paragraphs.ts), paginate.ts, themes.ts, settings.ts, export.ts, backup.ts, stats.ts, i18n/es.ts
store/          reader.ts, settings.ts, library.ts (zustand)
workers/        extract.worker.ts
public/         pdf.worker.min.mjs, manifest.webmanifest, icons/
```

## Modelo de datos (IndexedDB "pdf-reader", vía idb)
- `books` {id, title, author?, size, pageCount, coverBlob, hasText, toc[], addedAt, lastOpenedAt, finishedAt?, status:'reading'|'new'|'done'}
- `files` {bookId, blob} — PDF original
- `blocks` {bookId, blocks: {type:'h1'|'h2'|'p'|'li', text, page}[]} — reflow cacheado (no reprocesar)
- `progress` {bookId, mode:'reflow'|'page', blockIndex, charOffset, pdfPage, percent, updatedAt}
- `settings` {key:'global'|bookId, ...tipografía, tema, brillo, luzCálida}
- `annotations` {id, bookId, kind:'bookmark'|'highlight'|'note', color?, blockIndex, start, end, text, note?, createdAt} (índice bookId)
- `stats` {date 'YYYY-MM-DD', seconds, bookIds[]} + libros terminados vía `books.finishedAt`
- `meta` {key, value} — bienvenida vista, persist solicitado

## Algoritmo de reflow (worker)
1. Por página: `getTextContent()` → items con x, y, fontSize (|transform|), fontName/bold.
2. Cabeceras/pies: normalizar texto de franjas superior/inferior (dígitos → #); descartar si se repite en >50% de páginas; descartar números de página sueltos.
3. Columnas: histograma de x de inicio de línea; si hay hueco central claro → 2 columnas, ordenar izquierda luego derecha.
4. Agrupar items en líneas por y; líneas en párrafos: nuevo párrafo si gap vertical > 1.5× interlineado mediano, cambio de tamaño de fuente, o sangría/viñeta (`•`, `-`, `1.` → `li`).
5. Unir líneas con espacio; si termina en `-` + minúscula siguiente → unir sin guion.
6. Títulos: tamaño > mediana ×1.4 → h1, > mediana ×1.15 o negrita en línea corta → h2.
7. Sin texto útil (< ~20 caracteres/página promedio) → `hasText=false`.

## Paginación
Contenedor `100dvh` con `column-width = ancho útil`, `column-gap = 2×margen`, `height` fija; navegación `transform: translateX(-página×(ancho+gap))`; total = `ceil(scrollWidth / (ancho+gap))`. Posición = blockIndex + charOffset: al repaginar (fuente/tamaño/márgenes/rotación via ResizeObserver) se localiza el nodo con Range y se calcula su página por `getClientRects().left`. Cada bloque lleva `data-i`.

## Tareas
- [x] 1. Scaffolding: Next.js App Router + TS + Tailwind, deps (pdfjs-dist, idb, zustand, lucide-react, @serwist/next, @fontsource/*), `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/globals.css`, copia del worker pdf.js a `public/` (script postinstall).
- [x] 2. Textos i18n: todos los textos UI en español en `lib/i18n/es.ts` + helper `t()`.
- [x] 3. Capa de datos: esquema idb y CRUD de todos los stores en `lib/db.ts`; `navigator.storage.persist()` al primer uso.
- [x] 4. Temas: 7 temas + personalizado como variables CSS, automático (prefers-color-scheme), transición suave, meta theme-color, script inline anti-flash en `lib/themes.ts`, `app/layout.tsx`, `app/globals.css`.
- [x] 5. Fuentes y ajustes: @fontsource de las 7 fuentes, store de ajustes (defaults Literata 19px/1.6/medio/justificado+hyphens/sangría, global vs por libro, restablecer) en `lib/settings.ts`, `store/settings.ts`.
- [x] 6. Carga pdf.js: wrapper con worker local, apertura desde Blob, outline, miniatura 1ª página en `lib/pdf.ts`.
- [x] 7. Worker de extracción: reflow completo (algoritmo arriba) con progreso por página y detección de PDF escaneado en `workers/extract.worker.ts`, `lib/reflow/*`.
- [x] 8. Importación: botón, drag&drop y selector móvil (`accept=application/pdf`); guarda blob, portada, bloques; progreso visible sin bloquear UI con PDFs 100+MB en `components/library/Importer.tsx`.
- [x] 9. Biblioteca: cuadrícula de portadas con barra de progreso, grupos Leyendo/Sin empezar/Terminados, búsqueda y orden, eliminar con confirmación en `app/page.tsx`, `components/library/*`, `store/library.ts`.
- [x] 10. Bienvenida: primera visita con guía breve de gestos y declaración "sin analytics ni trackers" en `components/library/Welcome.tsx`.
- [x] 11. Shell del lector: ruta, 100dvh, safe-area, bloqueo de scroll/rebote, UI oculta (solo texto + línea de progreso) / visible, alternar modo conservando posición en `app/read/[id]/page.tsx`, `store/reader.ts`.
- [x] 12. Modo Lectura: render de bloques con tipografía aplicada (márgenes, ancho máx ~65ch, peso, espaciados, sangría/espacio párrafo) y paginación por CSS columns + translateX en `components/reader/ReflowView.tsx`, `lib/paginate.ts`.
- [x] 13. Repaginado con posición: blockIndex+charOffset al cambiar ajustes/orientación/tamaño; aviso de una línea y cambio a Página Original si no hay texto en `lib/paginate.ts`, `ReflowView.tsx`.
- [x] 14. Modo Página Original: canvas con devicePixelRatio, capa de texto, render bajo demanda + precarga siguiente + caché, filtros de tema (sepia/invert + mix-blend-mode) en `components/reader/PageView.tsx`.
- [x] 15. Zoom/gestos página original: pellizco, doble toque ajusta al ancho, arrastrar para mover en `components/reader/PageView.tsx`, `lib/gestures.ts`.
- [x] 16. Navegación: toques por tercios, swipe con animación deslizar/fundido (ninguna con prefers-reduced-motion), teclado (flechas, espacio, PgUp/PgDn, Home/End, F) en `lib/gestures.ts`, `components/reader/Navigator.tsx`.
- [x] 17. Barras: superior (volver, título, buscar, ajustes) e inferior (slider, "página X de Y", %, tiempo restante por velocidad real), zonas ≥44px en `components/reader/TopBar.tsx`, `BottomBar.tsx`.
- [x] 18. Panel de ajustes: fuentes, tamaño 12–40, interlineado 1.2–2.2, espaciado letras/palabras, márgenes, justificado/izquierda, sangría/espacio, peso, temas + personalizado, brillo y luz cálida (overlay ámbar), "solo este libro", restablecer, vista previa en vivo en `components/reader/SettingsPanel.tsx`.
- [x] 19. Progreso y retomar: guardado debounced de posición, estado terminado, retomar exacto al abrir en `store/reader.ts`, `lib/db.ts`.
- [x] 20. Tabla de contenidos: outline del PDF o generada desde h1/h2, saltar a sección en `components/reader/TocPanel.tsx`.
- [x] 21. Búsqueda: en bloques (reflow) y textContent (página), resaltado y anterior/siguiente en `components/reader/SearchPanel.tsx`.
- [x] 22. Anotaciones: marcadores, subrayados 4 colores, notas sobre selección; listado por libro y exportación Markdown en `components/reader/AnnotationsPanel.tsx`, `lib/export.ts`.
- [x] 23. Wake Lock, pantalla completa y estadísticas: tiempo leído por día, libros terminados, vista de estadísticas en `lib/stats.ts`, `components/library/Stats.tsx`.
- [x] 24. Copia de seguridad: exportar/importar JSON (progreso, notas, marcadores, ajustes) en `lib/backup.ts`, `components/library/BackupMenu.tsx`.
- [x] 25. PWA y despliegue: `manifest.webmanifest` (192/512, maskable, standalone, colores Papel), iconos SVG/PNG en `public/icons/`, service worker Serwist offline (precarga app, fuentes, worker pdf.js) en `app/sw.ts`, `next.config.ts`; verificar `npm run build` sin config extra.
