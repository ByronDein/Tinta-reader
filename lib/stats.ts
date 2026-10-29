import { addReadingSeconds, listBooks, listStats } from "./db";

export function dayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const recordSeconds = (bookId: string, seconds: number) => addReadingSeconds(dayKey(), seconds, bookId);

export async function loadStats() {
  const rows = await listStats();
  const byDay = new Map(rows.map((r) => [r.date, r.seconds]));
  const days: { date: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    days.push({ date: k, seconds: byDay.get(k) ?? 0 });
  }
  const total = rows.reduce((a, r) => a + r.seconds, 0);
  const done = (await listBooks()).filter((b) => b.finishedAt).length;
  return { days, total, today: byDay.get(dayKey()) ?? 0, done };
}
