// Genera los iconos PNG de la PWA (sin dependencias). Uso: node scripts/gen-icons.mjs
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [0xf4, 0xec, 0xd8];
const FG = [0x3b, 0x32, 0x26];

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

function png(size, scale) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const c = size / 2;
  const half = (size * scale) / 2; // semiancho del libro
  const h = half * 0.78; // semialto
  const gap = size * 0.012;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      // dos páginas con ligera curvatura superior hacia el lomo
      const inPage = Math.abs(dx) > gap && Math.abs(dx) < half && Math.abs(dy + Math.abs(dx) * 0.0) < h;
      const curve = Math.abs(dy - (Math.abs(dx) / half) * h * 0.18) < h;
      const lines = Math.abs(dx) > half * 0.18 && Math.abs(dx) < half * 0.82 && [-0.45, -0.15, 0.15, 0.45].some((k) => Math.abs(dy - k * h) < size * 0.008);
      const on = inPage && curve;
      const px = on ? (lines ? BG : FG) : BG;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = px[0];
      raw[o + 1] = px[1];
      raw[o + 2] = px[2];
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192, 0.62));
writeFileSync("public/icons/icon-512.png", png(512, 0.62));
writeFileSync("public/icons/maskable-512.png", png(512, 0.46));
writeFileSync(
  "public/icons/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#F4ECD8"/><g fill="#3B3226"><path d="M96 150c60-8 110 0 154 28v196c-44-28-94-36-154-28z"/><path d="M416 150c-60-8-110 0-154 28v196c44-28 94-36 154-28z"/></g></svg>`,
);
