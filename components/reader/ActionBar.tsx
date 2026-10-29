"use client";
import { Languages, NotebookPen, Trash2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HighlightColor } from "@/lib/types";
import { t } from "@/lib/i18n/es";
import { ColorDots } from "./AnnotationsPanel";

function Tool({ icon: Icon, tip, label, onClick }: { icon: LucideIcon; tip: string; label?: string; onClick: () => void }) {
  return (
    <button className="btn-icon gap-1 md:px-3" title={tip} aria-label={tip} onClick={onClick}>
      <Icon size={20} />
      {label && <span className="hidden text-sm md:inline">{label}</span>}
    </button>
  );
}

/**
 * Barra flotante del lector. Con texto seleccionado ofrece subrayar, anotar y traducir;
 * al tocar un subrayado existente permite cambiarle el color, la nota o quitarlo.
 */
export function ActionBar({
  color,
  onColor,
  onNote,
  onLookup,
  onRemove,
  onClose,
}: {
  /** color actual si la barra es de un subrayado existente */
  color?: HighlightColor;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onLookup: () => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const existing = !!onRemove;
  return (
    <div className="safe-bottom absolute inset-x-0 bottom-4 z-30 flex justify-center px-2">
      {/* mousedown no debe quitar la selección, o la barra desaparece antes del clic */}
      <div
        role="toolbar"
        className="flex max-w-full items-center rounded-full border border-line bg-bg px-2 shadow-xl"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Tool icon={Languages} tip={t.tips.lookup} label={t.lookup.button} onClick={onLookup} />
        <ColorDots value={color} verb={existing ? t.tips.recolor : t.tips.highlight} onPick={onColor} />
        <Tool icon={NotebookPen} tip={existing ? t.tips.editNote : t.tips.note} label={t.tips.noteShort} onClick={onNote} />
        {onRemove && <Tool icon={Trash2} tip={t.tips.remove} label={t.tips.removeShort} onClick={onRemove} />}
        <Tool icon={X} tip={existing ? t.tips.closeBar : t.tips.cancel} onClick={onClose} />
      </div>
    </div>
  );
}
