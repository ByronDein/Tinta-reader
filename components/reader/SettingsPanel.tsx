"use client";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { useSettings, useSettingsStore } from "@/store/settings";
import { FONTS, MARGIN_PX, fontCss, type ReaderSettings, type ThemeId } from "@/lib/settings";
import { THEME_COLORS, THEME_ORDER } from "@/lib/themes";
import { t } from "@/lib/i18n/es";

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        {value && <span className="text-muted">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Seg<T extends string | number | boolean>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: { v: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="mt-1 flex gap-1 rounded-xl bg-surface p-1">
      {options.map((o) => (
        <button
          key={String(o.v)}
          className="min-h-10 flex-1 rounded-lg px-2 text-sm"
          style={value === o.v ? { background: "var(--fg)", color: "var(--bg)" } : undefined}
          onClick={() => onPick(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function themeSwatch(id: ThemeId, s: ReaderSettings) {
  if (id === "custom") return { bg: s.customBg, fg: s.customFg };
  if (id === "auto") return { bg: "linear-gradient(135deg,#F4ECD8 50%,#1C1B19 50%)", fg: "#888" };
  return THEME_COLORS[id];
}

export function SettingsPanel({ hasBookOverride, onClose }: { hasBookOverride: boolean; onClose: () => void }) {
  const s = useSettings();
  const update = useSettingsStore((st) => st.update);
  const reset = useSettingsStore((st) => st.reset);
  const [onlyBook, setOnlyBook] = useState(hasBookOverride);
  const set = (p: Partial<ReaderSettings>) => update(p, onlyBook);
  const pt = t.settings;

  return (
    <Sheet title={pt.title} onClose={onClose} dim={false} maxHeight="62dvh">
      <div
        className="mt-2 rounded-2xl border border-line p-3"
        style={{
          fontFamily: fontCss(s.font),
          fontSize: Math.min(s.size, 22),
          lineHeight: s.lineHeight,
          letterSpacing: `${s.letterSpacing / 100}em`,
          wordSpacing: `${s.wordSpacing / 100}em`,
          fontWeight: s.weight,
          textAlign: s.justify ? "justify" : "left",
          hyphens: s.justify ? "auto" : "manual",
          textIndent: s.indent ? "1.5em" : 0,
        }}
      >
        <span className="mb-1 block text-xs font-sans uppercase tracking-wide text-muted" style={{ textIndent: 0 }}>
          {pt.preview}
        </span>
        {pt.previewText}
      </div>

      <label className="mt-3 flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--fg)" }} checked={onlyBook} onChange={(e) => setOnlyBook(e.target.checked)} />
        <span className="text-sm">{pt.onlyThisBook}</span>
      </label>

      <Row label={pt.theme}>
        <div className="mt-1 grid grid-cols-4 gap-2">
          {THEME_ORDER.map((id) => {
            const sw = themeSwatch(id, s);
            return (
              <button
                key={id}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-1 text-xs"
                style={{ borderColor: s.themeId === id ? "var(--fg)" : "var(--color-line)" }}
                onClick={() => set({ themeId: id })}
              >
                <span className="block h-6 w-6 rounded-full border border-line" style={{ background: sw.bg }} />
                {t.themes[id]}
              </button>
            );
          })}
        </div>
      </Row>
      {s.themeId === "custom" && (
        <div className="mt-2 flex gap-3">
          <label className="flex flex-1 items-center gap-2 text-sm">
            {pt.customBg}
            <input type="color" className="h-11 w-full" value={s.customBg} onChange={(e) => set({ customBg: e.target.value })} />
          </label>
          <label className="flex flex-1 items-center gap-2 text-sm">
            {pt.customFg}
            <input type="color" className="h-11 w-full" value={s.customFg} onChange={(e) => set({ customFg: e.target.value })} />
          </label>
        </div>
      )}

      <Row label={pt.brightness} value={`${s.brightness}%`}>
        <input type="range" min={40} max={100} step={1} value={s.brightness} onChange={(e) => set({ brightness: +e.target.value })} />
      </Row>
      <Row label={pt.warmth} value={`${s.warmth}%`}>
        <input type="range" min={0} max={100} step={1} value={s.warmth} onChange={(e) => set({ warmth: +e.target.value })} />
      </Row>

      <Row label={pt.font}>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {FONTS.map((f) => (
            <button
              key={f.id}
              className="min-h-11 rounded-xl border-2 px-2 text-sm"
              style={{ fontFamily: f.css, borderColor: s.font === f.id ? "var(--fg)" : "var(--color-line)" }}
              onClick={() => set({ font: f.id })}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label={pt.size} value={`${s.size} px`}>
        <input type="range" min={12} max={40} step={1} value={s.size} onChange={(e) => set({ size: +e.target.value })} />
      </Row>
      <Row label={pt.lineHeight} value={s.lineHeight.toFixed(2)}>
        <input type="range" min={1.2} max={2.2} step={0.05} value={s.lineHeight} onChange={(e) => set({ lineHeight: +e.target.value })} />
      </Row>
      <Row label={pt.letterSpacing} value={`${s.letterSpacing / 100} em`}>
        <input type="range" min={-2} max={10} step={1} value={s.letterSpacing} onChange={(e) => set({ letterSpacing: +e.target.value })} />
      </Row>
      <Row label={pt.wordSpacing} value={`${s.wordSpacing / 100} em`}>
        <input type="range" min={0} max={40} step={2} value={s.wordSpacing} onChange={(e) => set({ wordSpacing: +e.target.value })} />
      </Row>

      <Row label={pt.margins}>
        <Seg
          value={s.margin}
          onPick={(v) => set({ margin: v })}
          options={(Object.keys(MARGIN_PX) as (keyof typeof MARGIN_PX)[]).map((v) => ({ v, label: pt[v === "narrow" ? "narrow" : v === "medium" ? "medium" : "wide"] }))}
        />
      </Row>
      <Row label={pt.maxWidth} value={`${s.maxWidth} ch`}>
        <input type="range" min={40} max={90} step={1} value={s.maxWidth} onChange={(e) => set({ maxWidth: +e.target.value })} />
      </Row>
      <Row label={pt.align}>
        <Seg
          value={s.justify}
          onPick={(v) => set({ justify: v })}
          options={[
            { v: true, label: pt.justify },
            { v: false, label: pt.left },
          ]}
        />
      </Row>
      <Row label={pt.paragraphs}>
        <Seg
          value={s.indent}
          onPick={(v) => set({ indent: v })}
          options={[
            { v: true, label: pt.indent },
            { v: false, label: pt.spacing },
          ]}
        />
      </Row>
      <Row label={pt.weight}>
        <Seg
          value={s.weight}
          onPick={(v) => set({ weight: v })}
          options={[
            { v: 400, label: pt.normal },
            { v: 500, label: pt.mid },
            { v: 700, label: pt.bold },
          ]}
        />
      </Row>
      <Row label={pt.animation}>
        <Seg
          value={s.anim}
          onPick={(v) => set({ anim: v })}
          options={[
            { v: "slide", label: pt.slide },
            { v: "fade", label: pt.fade },
            { v: "none", label: pt.none },
          ]}
        />
      </Row>

      <button className="btn mt-5 w-full" onClick={() => reset(onlyBook)}>
        {pt.reset}
      </button>
    </Sheet>
  );
}
