"use client";
import { X } from "lucide-react";
import { t } from "@/lib/i18n/es";

export function Sheet({
  title,
  onClose,
  dim = true,
  maxHeight = "80dvh",
  children,
}: {
  title: string;
  onClose: () => void;
  dim?: boolean;
  maxHeight?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-label={title}>
      <button
        aria-label={t.reader.close}
        className="absolute inset-0 h-full w-full cursor-default border-0"
        style={{ background: dim ? "rgba(0,0,0,0.45)" : "transparent" }}
        onClick={onClose}
      />
      <div
        className="safe-bottom absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-xl flex-col rounded-t-3xl border-t border-line bg-bg shadow-2xl"
        style={{ maxHeight, touchAction: "pan-y" }}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pt-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t.reader.close}>
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
