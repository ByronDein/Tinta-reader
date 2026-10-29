"use client";
import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { deleteVocab, listVocab } from "@/lib/db";
import { downloadText } from "@/lib/export";
import { t } from "@/lib/i18n/es";
import type { VocabEntry } from "@/lib/types";

const csv = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

export function Vocabulary({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<VocabEntry[] | null>(null);

  useEffect(() => {
    void listVocab().then((l) => setList(l.sort((a, b) => b.createdAt - a.createdAt)));
  }, []);

  const exportCsv = () => {
    const rows = (list ?? []).map((v) => [v.word, v.meaning, v.definition, v.context].map(csv).join(","));
    downloadText("vocabulario.csv", ["﻿palabra,traducción,definición,contexto", ...rows].join("\n"), "text/csv");
  };

  return (
    <Sheet title={t.lookup.vocab} onClose={onClose}>
      {list && !list.length && <p className="py-6 text-muted">{t.lookup.vocabEmpty}</p>}
      <ul>
        {list?.map((v) => (
          <li key={v.id} className="flex items-start gap-1 border-b border-line py-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {v.word}
                {v.meaning && <span className="font-normal"> — {v.meaning}</span>}
              </p>
              {v.definition && <p className="text-sm text-muted">{v.definition}</p>}
              {v.context && <p className="mt-1 line-clamp-3 text-sm italic text-muted">“{v.context}”</p>}
              <p className="mt-1 text-xs text-muted">{v.bookTitle}</p>
            </div>
            <button
              className="btn-icon"
              aria-label={t.reader.remove}
              onClick={() => {
                void deleteVocab(v.id);
                setList((l) => l?.filter((x) => x.id !== v.id) ?? null);
              }}
            >
              <Trash2 size={18} />
            </button>
          </li>
        ))}
      </ul>
      {!!list?.length && (
        <button className="btn mt-4 w-full" onClick={exportCsv}>
          <Download size={18} /> {t.lookup.vocabExport}
        </button>
      )}
    </Sheet>
  );
}
