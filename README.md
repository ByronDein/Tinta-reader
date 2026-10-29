# Lector PDF

Lector de PDF tipo Kindle que funciona 100 % en el navegador: sin backend, sin cuentas, sin analytics. Tus archivos se guardan en IndexedDB y nunca salen del dispositivo.

- **Modo Lectura** (por defecto): el texto del PDF se reconstruye en párrafos y títulos y se pagina como un libro electrónico (fuente, tamaño, márgenes y temas ajustables, con repaginado que conserva la posición).
- **Modo Página Original**: la página del PDF con zoom, texto seleccionable y el tema de color aplicado.
- Biblioteca con portadas, progreso, marcadores, subrayados, notas (exportables a Markdown), búsqueda, estadísticas y copia de seguridad en JSON.
- PWA: tras la primera visita funciona sin conexión.

## Cómo correr

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

`npm install` copia el worker y los recursos de pdf.js a `public/` (script `postinstall`).

## Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En Vercel: *Add New → Project*, importa el repositorio y pulsa *Deploy*. No requiere variables de entorno ni configuración extra (plan Hobby).

## Notas

- Decisiones técnicas: ver `DECISIONES.md`.
- Los textos de la interfaz están en `lib/i18n/es.ts`.
- El service worker (`public/sw.js`) solo se registra en producción.
