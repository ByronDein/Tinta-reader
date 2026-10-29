"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Book } from "@/lib/types";

export function Cover({ blob, title }: { blob?: Blob; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url)
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface p-3 text-center text-sm text-muted">
        {title}
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={title} className="h-full w-full object-cover" draggable={false} />;
}

export function BookCard({ book, percent, onDelete }: { book: Book; percent: number; onDelete: () => void }) {
  return (
    <div className="relative">
      <Link href={`/read?id=${encodeURIComponent(book.id)}`} className="block">
        <div className="aspect-[3/4] overflow-hidden rounded-xl border border-line shadow-sm">
          <Cover blob={book.coverBlob} title={book.title} />
        </div>
        <div className="mt-2 line-clamp-2 min-h-10 text-sm font-medium leading-5">{book.title}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-fg" style={{ width: `${Math.round(percent * 100)}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted">{Math.round(percent * 100)}%</div>
      </Link>
      <button
        className="btn-icon absolute right-1 top-1 bg-bg/80 backdrop-blur"
        aria-label="Eliminar"
        onClick={onDelete}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
