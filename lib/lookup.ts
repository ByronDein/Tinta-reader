import { getDict, putDict } from "./db";

export interface DictEntry {
  word: string;
  phonetic?: string;
  /** la palabra encontrada no es exactamente la seleccionada (p. ej. "invested" → "invest") */
  fromBase: boolean;
  meanings: { pos: string; defs: { def: string; example?: string }[] }[];
}

export type DefResult = { status: "ok"; entry: DictEntry } | { status: "none" } | { status: "offline" };
export type TrResult =
  | { status: "ok"; text: string; truncated: boolean }
  | { status: "limit" }
  | { status: "offline" };

const TIMEOUT = 8000;
const MAX_TRANSLATE = 1800;

async function getJson(url: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

const plain = (html: string) => (new DOMParser().parseFromString(html, "text/html").documentElement.textContent ?? "").replace(/\s+/g, " ").trim();

/** Quita puntuación de los extremos de lo seleccionado. */
export const cleanSelection = (text: string) =>
  text.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();

/** ¿Es una sola palabra (con apóstrofo o guion)? */
export const isWord = (text: string) => text.length <= 40 && /^\p{L}[\p{L}'’-]*$/u.test(text);

/** Frase del libro que contiene lo seleccionado. */
export function sentenceAround(block: string, start: number, end: number) {
  let a = start;
  while (a > 0 && !/[.!?]\s/.test(block.slice(a - 1, a + 1))) a--;
  let b = end;
  while (b < block.length && !/[.!?]/.test(block[b - 1] ?? "")) b++;
  const s = block.slice(a, b).trim();
  return s.length > 300 ? s.slice(Math.max(0, start - a - 120), start - a + 180).trim() : s;
}

/** Formas base probables de una palabra conjugada o en plural. */
function forms(raw: string) {
  const w = raw.toLowerCase().replace(/’/g, "'");
  const out = [w];
  const add = (x: string) => {
    if (x.length > 1 && !out.includes(x)) out.push(x);
  };
  const undouble = (b: string) => b.length > 2 && b.at(-1) === b.at(-2) && add(b.slice(0, -1));
  if (w.endsWith("'s")) add(w.slice(0, -2));
  if (w.endsWith("ies")) add(`${w.slice(0, -3)}y`);
  if (w.endsWith("es")) add(w.slice(0, -2));
  if (w.endsWith("s")) add(w.slice(0, -1));
  if (w.endsWith("ied")) add(`${w.slice(0, -3)}y`);
  if (w.endsWith("ed")) {
    add(w.slice(0, -2));
    add(w.slice(0, -1));
    undouble(w.slice(0, -2));
  }
  if (w.endsWith("ing")) {
    const b = w.slice(0, -3);
    add(b);
    add(`${b}e`);
    undouble(b);
  }
  if (w.endsWith("ly")) add(w.slice(0, -2));
  return out.slice(0, 6);
}

interface ApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings?: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[];
}

type Found = { phonetic?: string; meanings: DictEntry["meanings"] } | "none" | "fail";

async function fromDictionaryApi(w: string): Promise<Found> {
  const r = await getJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
  if (r.status === 404) return "none";
  if (!r.ok || !Array.isArray(r.json)) return "fail";
  const entries = r.json as ApiEntry[];
  const meanings = entries.flatMap((e) => e.meanings ?? []).map((m) => ({
    pos: m.partOfSpeech,
    defs: m.definitions.slice(0, 2).map((d) => ({ def: d.definition, example: d.example })),
  }));
  if (!meanings.length) return "none";
  const phonetic = entries.find((e) => e.phonetic)?.phonetic ?? entries.flatMap((e) => e.phonetics ?? []).find((p) => p.text)?.text;
  return { phonetic, meanings: meanings.slice(0, 4) };
}

interface WiktEntry {
  partOfSpeech: string;
  definitions: { definition: string; examples?: string[] }[];
}

async function fromWiktionary(w: string): Promise<Found> {
  const r = await getJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w)}`);
  if (r.status === 404) return "none";
  const list = (r.json as { en?: WiktEntry[] } | null)?.en;
  if (!r.ok || !Array.isArray(list)) return "fail";
  const meanings = list
    .map((m) => ({
      pos: m.partOfSpeech.toLowerCase(),
      defs: m.definitions
        .map((d) => ({ def: plain(d.definition), example: d.examples?.[0] ? plain(d.examples[0]) : undefined }))
        .filter((d) => d.def)
        .slice(0, 2),
    }))
    .filter((m) => m.defs.length);
  return meanings.length ? { meanings: meanings.slice(0, 4) } : "none";
}

/** Definición en inglés. Prueba formas base y dos fuentes; guarda el resultado en el dispositivo. */
export async function define(word: string): Promise<DefResult> {
  const key = `def:${word.toLowerCase()}`;
  const cached = await getDict<DictEntry | null>(key).catch(() => undefined);
  if (cached) return { status: "ok", entry: cached };
  if (cached === null) return { status: "none" };

  let failed = false;
  for (const w of forms(word)) {
    for (const source of [fromDictionaryApi, fromWiktionary]) {
      let res: Found;
      try {
        res = await source(w);
      } catch {
        failed = true;
        continue;
      }
      if (res === "fail") failed = true;
      if (typeof res === "object") {
        const entry: DictEntry = { word: w, phonetic: res.phonetic, fromBase: w !== word.toLowerCase(), meanings: res.meanings };
        void putDict(key, entry).catch(() => {});
        return { status: "ok", entry };
      }
    }
  }
  if (failed) return { status: "offline" };
  void putDict(key, null).catch(() => {});
  return { status: "none" };
}

function chunks(text: string, max = 450) {
  const out: string[] = [];
  let cur = "";
  for (const part of text.split(/(?<=[.!?])\s+/)) {
    const next = cur ? `${cur} ${part}` : part;
    if (next.length > max && cur) {
      out.push(cur);
      cur = part.slice(0, max);
    } else cur = next.slice(0, max);
  }
  if (cur) out.push(cur);
  return out;
}

/** Traducción con MyMemory (gratuito, sin clave). Las ya consultadas funcionan sin conexión. */
export async function translate(text: string, from: string, to: string): Promise<TrResult> {
  const src = text.replace(/\s+/g, " ").trim();
  const truncated = src.length > MAX_TRANSLATE;
  const input = src.slice(0, MAX_TRANSLATE);
  const key = `tr:${from}${to}:${input.toLowerCase()}`;
  const cached = await getDict<string>(key).catch(() => undefined);
  if (cached) return { status: "ok", text: cached, truncated };

  const parts: string[] = [];
  try {
    for (const q of chunks(input)) {
      const r = await getJson(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${from}|${to}`,
      );
      const body = r.json as { responseData?: { translatedText?: string }; responseStatus?: number | string } | null;
      const out = body?.responseData?.translatedText ?? "";
      if (Number(body?.responseStatus) === 429 || /MYMEMORY WARNING/i.test(out)) return { status: "limit" };
      if (!r.ok || !out) return { status: "offline" };
      parts.push(plain(out));
    }
  } catch {
    return { status: "offline" };
  }
  const result = parts.join(" ");
  void putDict(key, result).catch(() => {});
  return { status: "ok", text: result, truncated };
}
