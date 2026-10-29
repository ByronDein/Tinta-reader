import type { ReaderSettings, ThemeId } from "./settings";

export const THEME_COLORS: Record<Exclude<ThemeId, "auto" | "custom">, { bg: string; fg: string }> = {
  paper: { bg: "#F4ECD8", fg: "#3B3226" },
  sepia: { bg: "#E9DCC0", fg: "#4A3B28" },
  soft: { bg: "#FAF8F3", fg: "#2A2A2A" },
  gray: { bg: "#D9D9D6", fg: "#2B2B2B" },
  dark: { bg: "#1C1B19", fg: "#C9C3B6" },
  oled: { bg: "#000000", fg: "#9A958A" },
};

export const THEME_ORDER: ThemeId[] = ["auto", "paper", "sepia", "soft", "gray", "dark", "oled", "custom"];

export const THEME_STORAGE_KEY = "pr-theme";

export function resolveColors(s: Pick<ReaderSettings, "themeId" | "customBg" | "customFg">) {
  if (s.themeId === "custom") return { id: "custom" as const, bg: s.customBg, fg: s.customFg };
  let id = s.themeId;
  if (id === "auto") {
    const dark = typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
    id = dark ? "dark" : "paper";
  }
  const c = THEME_COLORS[id as keyof typeof THEME_COLORS];
  return { id, bg: c.bg, fg: c.fg };
}

export function isDarkColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
}

/** Aplica tema, brillo y luz cálida al documento y guarda caché para el script anti-flash. */
export function applyTheme(s: Pick<ReaderSettings, "themeId" | "customBg" | "customFg" | "brightness" | "warmth">) {
  const root = document.documentElement;
  const c = resolveColors(s);
  root.dataset.theme = c.id;
  if (c.id === "custom") {
    root.style.setProperty("--bg", c.bg);
    root.style.setProperty("--fg", c.fg);
  } else {
    root.style.removeProperty("--bg");
    root.style.removeProperty("--fg");
  }
  root.dataset.dark = isDarkColor(c.bg) ? "1" : "0";
  root.style.setProperty("--brightness", String(s.brightness / 100));
  root.style.setProperty("--warmth", String(s.warmth / 100));
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", c.bg);
  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ t: s.themeId, bg: s.customBg, fg: s.customFg, b: s.brightness, w: s.warmth }),
    );
  } catch {}
}

/** Script inline que corre antes de pintar para evitar el flash del tema incorrecto. */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var s=JSON.parse(localStorage.getItem('${THEME_STORAGE_KEY}')||'null')||{t:'paper',b:100,w:0};var C={paper:['#F4ECD8'],sepia:['#E9DCC0'],soft:['#FAF8F3'],gray:['#D9D9D6'],dark:['#1C1B19'],oled:['#000000']};var id=s.t;if(id==='auto'){id=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'paper'}var bg;if(id==='custom'){bg=s.bg;d.style.setProperty('--bg',s.bg);d.style.setProperty('--fg',s.fg)}else{bg=(C[id]||C.paper)[0]}d.dataset.theme=id;var n=parseInt(bg.slice(1),16);var l=0.2126*((n>>16)&255)+0.7152*((n>>8)&255)+0.0722*(n&255);d.dataset.dark=l<128?'1':'0';d.style.setProperty('--brightness',String((s.b==null?100:s.b)/100));d.style.setProperty('--warmth',String((s.w||0)/100));var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',bg)}catch(e){}})();`;
