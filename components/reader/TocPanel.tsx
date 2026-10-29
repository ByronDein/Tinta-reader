"use client";
import type { TocItem } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { t } from "@/lib/i18n/es";

export function TocPanel({
  toc,
  onSelect,
  onClose,
}: {
  toc: TocItem[];
  onSelect: (item: TocItem) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={t.reader.toc} onClose={onClose}>
      {!toc.length && <p className="py-6 text-muted">{t.reader.noToc}</p>}
      <ul>
        {toc.map((item, i) => (
          <li key={i}>
            <button
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg py-2 text-left active:bg-surface"
              style={{ paddingLeft: item.level * 16 }}
              onClick={() => onSelect(item)}
            >
              <span className={item.level === 0 ? "font-medium" : "text-muted"}>{item.title}</span>
              <span className="shrink-0 text-xs text-muted">{item.page}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
