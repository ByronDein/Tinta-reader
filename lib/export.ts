import type { Annotation, Book } from "./types";
import { t } from "./i18n/es";

export function annotationsToMarkdown(book: Book, list: Annotation[]) {
  const sorted = [...list].sort((a, b) => a.page - b.page || a.blockIndex - b.blockIndex || a.start - b.start);
  const lines = [`# ${book.title}`, ""];
  if (book.author) lines.push(`*${book.author}*`, "");
  const marks = sorted.filter((a) => a.kind === "bookmark");
  const notes = sorted.filter((a) => a.kind !== "bookmark");
  if (marks.length) {
    lines.push(`## ${t.reader.bookmarks}`, "");
    for (const a of marks) lines.push(`- ${t.reader.page} ${a.page}${a.text ? `: ${a.text}` : ""}`);
    lines.push("");
  }
  if (notes.length) {
    lines.push(`## ${t.reader.highlights}`, "");
    for (const a of notes) {
      lines.push(`> ${a.text.replace(/\n+/g, " ")}`, `> — ${t.reader.page} ${a.page} (${a.color ?? "yellow"})`);
      if (a.note) lines.push("", a.note);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function downloadText(name: string, text: string, type = "text/markdown") {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
