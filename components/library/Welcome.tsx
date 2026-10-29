"use client";
import { ChevronLeft, ChevronRight, Hand, ShieldCheck, MoveHorizontal } from "lucide-react";
import { t } from "@/lib/i18n/es";

export function Welcome({ onStart }: { onStart: () => void }) {
  const rows = [
    { icon: <ChevronRight size={20} />, text: t.welcome.gRight },
    { icon: <ChevronLeft size={20} />, text: t.welcome.gLeft },
    { icon: <Hand size={20} />, text: t.welcome.gCenter },
    { icon: <MoveHorizontal size={20} />, text: t.welcome.gSwipe },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="safe-bottom max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-6 sm:rounded-3xl">
        <h2 className="text-2xl font-semibold">{t.welcome.title}</h2>
        <p className="mt-2 text-muted">{t.welcome.lead}</p>
        <div className="mt-4 flex gap-3 rounded-2xl bg-surface p-3">
          <ShieldCheck size={22} className="mt-0.5 shrink-0" />
          <p className="text-sm">{t.welcome.privacy}</p>
        </div>
        <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">{t.welcome.gestures}</h3>
        <ul className="mt-2 space-y-1">
          {rows.map((r) => (
            <li key={r.text} className="flex min-h-11 items-center gap-3">
              <span className="text-muted">{r.icon}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary mt-5 w-full" onClick={onStart}>
          {t.welcome.start}
        </button>
      </div>
    </div>
  );
}
