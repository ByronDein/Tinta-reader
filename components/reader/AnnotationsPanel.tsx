"use client";
import { useState } from "react";
import { Bookmark, Download, Trash2 } from "lucide-react";
import type { Annotation, Book, HighlightColor } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { annotationsToMarkdown, downloadText } from "@/lib/export";
import { t } from "@/lib/i18n/es";

export const COLORS: { id: HighlightColor; hex: string }[] = [
  { id: "yellow", hex: "#f6e05e" },
  { id: "green", hex: "#68d391" },
  { id: "blue", hex: "#63b3ed" },
  { id: "pink", hex: "#f687b3" },
];

export function ColorDots({ value, onPick }: { value?: HighlightColor; onPick: (c: HighlightColor) => void }) {
  return (
    <div className="flex gap-1">
      {COLORS.map((c) => (
        <button
          key={c.id}
          aria-label={t.colors[c.id]}
          className="btn-icon"
          onClick={() => onPick(c.id)}
        >
          <span
            className="block h-7 w-7 rounded-full border-2"
            style={{ background: c.hex, borderColor: value === c.id ? "var(--fg)" : "transparent" }}
          />
        </button>
      ))}
    </div>
  );
}

export function HighlightEditor({
  ann,
  onSave,
  onDelete,
  onClose,
}: {
  ann: Annotation;
  onSave: (a: Annotation) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState(ann.note ?? "");
  const [color, setColor] = useState<HighlightColor>(ann.color ?? "yellow");
  return (
    <Sheet title={t.reader.addNote} onClose={onClose} maxHeight="75dvh">
      <blockquote className="my-2 border-l-4 pl-3 text-sm text-muted" style={{ borderColor: COLORS.find((c) => c.id === color)?.hex }}>
        {ann.text}
      </blockquote>
      <ColorDots value={color} onPick={setColor} />
      <textarea
        className="field mt-2 min-h-28 py-2"
        placeholder={t.reader.notePlaceholder}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-3 flex justify-between gap-2">
        <button
          className="btn"
          onClick={() => {
            onDelete(ann.id);
            onClose();
          }}
        >
          <Trash2 size={18} /> {t.reader.remove}
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            const n = note.trim();
            onSave({ ...ann, color, note: n || undefined, kind: n ? "note" : "highlight" });
            onClose();
          }}
        >
          {t.reader.save}
        </button>
      </div>
    </Sheet>
  );
}

export function AnnotationsPanel({
  book,
  annotations,
  onOpen,
  onEdit,
  onDelete,
  onClose,
}: {
  book: Book;
  annotations: Annotation[];
  onOpen: (a: Annotation) => void;
  onEdit: (a: Annotation) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const sorted = [...annotations].sort((a, b) => a.page - b.page || a.blockIndex - b.blockIndex || a.start - b.start);
  const marks = sorted.filter((a) => a.kind === "bookmark");
  const notes = sorted.filter((a) => a.kind !== "bookmark");
  const row = (a: Annotation) => (
    <li key={a.id} className="flex items-start gap-1 border-b border-line py-1">
      <button className="min-h-11 flex-1 py-1 text-left" onClick={() => onOpen(a)}>
        <div className="flex items-center gap-2 text-xs text-muted">
          {a.kind === "bookmark" ? (
            <Bookmark size={14} />
          ) : (
            <span className="h-3 w-3 rounded-full" style={{ background: COLORS.find((c) => c.id === a.color)?.hex }} />
          )}
          {t.reader.page} {a.page}
        </div>
        {a.text && <div className="mt-0.5 line-clamp-3 text-sm">{a.text}</div>}
        {a.note && <div className="mt-1 text-sm italic text-muted">{a.note}</div>}
      </button>
      {a.kind !== "bookmark" && (
        <button className="btn-icon text-sm" onClick={() => onEdit(a)} aria-label={t.reader.addNote}>
          ✎
        </button>
      )}
      <button className="btn-icon" onClick={() => onDelete(a.id)} aria-label={t.reader.remove}>
        <Trash2 size={18} />
      </button>
    </li>
  );
  return (
    <Sheet title={t.reader.notes} onClose={onClose}>
      {!annotations.length && <p className="py-6 text-muted">{t.reader.noAnnotations}</p>}
      {marks.length > 0 && (
        <>
          <h3 className="mt-3 text-sm font-semibold uppercase tracking-wide text-muted">{t.reader.bookmarks}</h3>
          <ul>{marks.map(row)}</ul>
        </>
      )}
      {notes.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-muted">{t.reader.highlights}</h3>
          <ul>{notes.map(row)}</ul>
        </>
      )}
      {annotations.length > 0 && (
        <button
          className="btn mt-4 w-full"
          onClick={() => downloadText(`${book.title.slice(0, 60)}.md`, annotationsToMarkdown(book, annotations))}
        >
          <Download size={18} /> {t.reader.exportMd}
        </button>
      )}
    </Sheet>
  );
}
