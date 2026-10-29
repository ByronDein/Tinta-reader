"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, BookmarkPlus, Check, Loader2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { deleteVocab, getMeta, getVocab, putVocab, setMeta } from "@/lib/db";
import { cleanSelection, define, isWord, translate, type DefResult, type TrResult } from "@/lib/lookup";
import { t } from "@/lib/i18n/es";
import type { Book } from "@/lib/types";

type Dir = "en-es" | "es-en";

export function LookupSheet({
  text,
  context,
  book,
  onClose,
}: {
  text: string;
  context: string;
  book: Book;
  onClose: () => void;
}) {
  const clean = useMemo(() => cleanSelection(text), [text]);
  const word = isWord(clean);
  const [dir, setDir] = useState<Dir>("en-es");
  const [tab, setTab] = useState<"def" | "tr">("def");
  const [def, setDef] = useState<DefResult | null>(null);
  const [tr, setTr] = useState<TrResult | null>(null);
  const [saved, setSaved] = useState(false);
  const id = clean.toLowerCase();

  useEffect(() => {
    void getMeta<Dir>("lookupDir").then((v) => v === "es-en" && setDir("es-en"));
    void getVocab(id).then((v) => setSaved(!!v));
  }, [id]);

  useEffect(() => {
    let dead = false;
    const [from, to] = dir.split("-");
    setDef(null);
    setTr(null);
    if (word && dir === "en-es") void define(clean).then((r) => !dead && setDef(r));
    void translate(clean, from, to).then((r) => !dead && setTr(r));
    return () => {
      dead = true;
    };
  }, [clean, dir, word]);

  const showDef = word && dir === "en-es";
  const active = showDef ? tab : "tr";

  const flip = () => {
    const next: Dir = dir === "en-es" ? "es-en" : "en-es";
    setDir(next);
    void setMeta("lookupDir", next);
  };

  const toggleSave = async () => {
    if (saved) {
      await deleteVocab(id);
      return setSaved(false);
    }
    const firstDef = def?.status === "ok" ? def.entry.meanings[0]?.defs[0]?.def : undefined;
    await putVocab({
      id,
      word: clean,
      meaning: tr?.status === "ok" && word ? tr.text : undefined,
      definition: firstDef,
      context,
      bookId: book.id,
      bookTitle: book.title,
      createdAt: Date.now(),
    });
    setSaved(true);
  };

  const spinner = (
    <p className="flex items-center gap-2 py-4 text-muted">
      <Loader2 size={18} className="animate-spin" /> {t.lookup.loading}
    </p>
  );

  return (
    <Sheet title={clean.length > 40 ? t.lookup.selection : clean} onClose={onClose} maxHeight="75dvh">
      <div className="flex items-center justify-between gap-2">
        {showDef ? (
          <div className="flex gap-1" role="tablist">
            {(["def", "tr"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={active === k}
                className={`btn !min-h-9 !px-3 text-sm ${active === k ? "btn-primary" : ""}`}
                onClick={() => setTab(k)}
              >
                {k === "def" ? t.lookup.definition : t.lookup.spanish}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted">{dir === "en-es" ? t.lookup.spanish : t.lookup.english}</span>
        )}
        <button className="btn !min-h-9 !px-3 text-sm" onClick={flip} aria-label={t.lookup.direction}>
          <ArrowLeftRight size={16} /> {dir === "en-es" ? "EN → ES" : "ES → EN"}
        </button>
      </div>

      <div className="mt-3 min-h-24">
        {active === "def" &&
          (!def ? (
            spinner
          ) : def.status === "ok" ? (
            <div>
              {def.entry.phonetic && <p className="text-muted">{def.entry.phonetic}</p>}
              {def.entry.fromBase && (
                <p className="mt-1 text-sm text-muted">
                  {t.lookup.fromBase} <strong>{def.entry.word}</strong>
                </p>
              )}
              {def.entry.meanings.map((m, i) => (
                <div key={i} className="mt-3">
                  <p className="text-sm font-semibold italic text-muted">{m.pos}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {m.defs.map((d, j) => (
                      <li key={j}>
                        {d.def}
                        {d.example && <span className="block text-sm italic text-muted">“{d.example}”</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-muted">{def.status === "none" ? t.lookup.none : t.lookup.offline}</p>
          ))}

        {active === "tr" &&
          (!tr ? (
            spinner
          ) : tr.status === "ok" ? (
            <div>
              <p className="text-lg leading-snug">{tr.text}</p>
              {tr.truncated && <p className="mt-2 text-sm text-muted">{t.lookup.truncated}</p>}
            </div>
          ) : (
            <p className="py-4 text-muted">{tr.status === "limit" ? t.lookup.limit : t.lookup.offline}</p>
          ))}
      </div>

      {word && (
        <button className="btn mt-3 w-full" onClick={() => void toggleSave()}>
          {saved ? <Check size={18} /> : <BookmarkPlus size={18} />} {saved ? t.lookup.saved : t.lookup.save}
        </button>
      )}
      <p className="mt-3 text-xs text-muted">{t.lookup.privacy}</p>
    </Sheet>
  );
}
