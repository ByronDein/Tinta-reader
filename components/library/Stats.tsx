"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { loadStats } from "@/lib/stats";
import { t } from "@/lib/i18n/es";

type Data = Awaited<ReturnType<typeof loadStats>>;
const mins = (s: number) => Math.round(s / 60);

export function Stats({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => {
    void loadStats().then(setD);
  }, []);
  const max = Math.max(60, ...(d?.days.map((x) => x.seconds) ?? [0]));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom w-full max-w-md rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.stats.title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t.reader.close}>
            <X size={22} />
          </button>
        </div>
        {d && d.total === 0 && <p className="mt-2 text-muted">{t.stats.noData}</p>}
        {d && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                [t.stats.today, `${mins(d.today)} ${t.stats.min}`],
                [t.stats.total, `${mins(d.total)} ${t.stats.min}`],
                [t.stats.booksDone, String(d.done)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-surface p-3">
                  <div className="text-lg font-semibold">{v}</div>
                  <div className="text-xs text-muted">{k}</div>
                </div>
              ))}
            </div>
            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-muted">{t.stats.week}</h3>
            <div className="mt-3 flex h-32 items-end gap-2">
              {d.days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-muted">{mins(day.seconds) || ""}</span>
                  <div
                    className="w-full rounded-t-md bg-fg"
                    style={{ height: `${Math.max(2, (day.seconds / max) * 80)}px`, opacity: day.seconds ? 1 : 0.2 }}
                  />
                  <span className="text-[10px] text-muted">{day.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
