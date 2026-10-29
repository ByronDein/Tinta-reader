export type ThemeId = "auto" | "paper" | "sepia" | "soft" | "gray" | "dark" | "oled" | "custom";
export type FontId = "literata" | "source" | "merriweather" | "garamond" | "inter" | "atkinson" | "dyslexic";
export type Margin = "narrow" | "medium" | "wide";
export type Anim = "slide" | "fade" | "none";

export interface ReaderSettings {
  themeId: ThemeId;
  customBg: string;
  customFg: string;
  brightness: number; // 40..100
  warmth: number; // 0..100
  font: FontId;
  size: number;
  lineHeight: number;
  letterSpacing: number; // centésimas de em, -2..10
  wordSpacing: number; // centésimas de em, 0..40
  margin: Margin;
  maxWidth: number; // ch
  justify: boolean;
  indent: boolean; // true: sangría; false: espacio entre párrafos
  weight: 400 | 500 | 700;
  anim: Anim;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  themeId: "paper",
  customBg: "#F4ECD8",
  customFg: "#3B3226",
  brightness: 100,
  warmth: 0,
  font: "literata",
  size: 19,
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  margin: "medium",
  maxWidth: 65,
  justify: true,
  indent: true,
  weight: 400,
  anim: "slide",
};

export const FONTS: { id: FontId; label: string; css: string }[] = [
  { id: "literata", label: "Literata", css: "'Literata', Georgia, serif" },
  { id: "source", label: "Source Serif 4", css: "'Source Serif 4', Georgia, serif" },
  { id: "merriweather", label: "Merriweather", css: "'Merriweather', Georgia, serif" },
  { id: "garamond", label: "EB Garamond", css: "'EB Garamond', Georgia, serif" },
  { id: "inter", label: "Inter", css: "'Inter', system-ui, sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", css: "'Atkinson Hyperlegible', system-ui, sans-serif" },
  { id: "dyslexic", label: "OpenDyslexic", css: "'OpenDyslexic', system-ui, sans-serif" },
];

export const MARGIN_PX: Record<Margin, number> = { narrow: 14, medium: 26, wide: 44 };

export function fontCss(id: FontId) {
  return (FONTS.find((f) => f.id === id) ?? FONTS[0]).css;
}
