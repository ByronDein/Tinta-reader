"use client";
import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup";
import { t } from "@/lib/i18n/es";

export function BackupMenu({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom w-full max-w-md rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.library.backup}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t.reader.close}>
            <X size={22} />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{t.library.backupNote}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button className="btn" onClick={() => void exportBackup()}>
            <Download size={18} /> {t.library.exportBackup}
          </button>
          <button className="btn" onClick={() => input.current?.click()}>
            <Upload size={18} /> {t.library.importBackup}
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const ok = await importBackup(f);
              setMsg(ok ? t.library.backupOk : t.library.backupBad);
              if (ok) onImported();
            }}
          />
        </div>
        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
