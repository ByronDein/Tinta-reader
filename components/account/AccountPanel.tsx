"use client";
import { useState } from "react";
import { Download, LogOut, RefreshCw, Trash2, X } from "lucide-react";
import { exportBackup } from "@/lib/backup";
import { deleteAccount, syncAll, useSync } from "@/lib/sync";
import { useAuth } from "@/store/auth";
import { t } from "@/lib/i18n/es";

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="safe-bottom max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t.account.title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label={t.reader.close}>
            <X size={22} />
          </button>
        </div>
        {user ? <SignedIn email={user.email ?? ""} onClose={onClose} /> : <SignIn />}
      </div>
    </div>
  );
}

function SignIn() {
  const { sendCode, verify } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    setBusy(true);
    setError("");
    const err = await sendCode(email.trim());
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };
  const check = async () => {
    setBusy(true);
    setError("");
    const err = await verify(email.trim(), code.trim());
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <div className="mt-2">
      <p className="text-sm text-muted">{t.account.intro}</p>
      {!sent ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (accepted && email.trim() && !busy) void send();
          }}
        >
          <label className="text-sm">
            {t.account.email}
            <input
              className="field mt-1"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              {t.account.consent}{" "}
              <a href="/privacidad" target="_blank" rel="noopener" className="underline">
                {t.account.privacyLink}
              </a>
              .
            </span>
          </label>
          <button className="btn btn-primary" type="submit" disabled={!accepted || !email.trim() || busy}>
            {busy ? t.account.sending : t.account.sendCode}
          </button>
        </form>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim() && !busy) void check();
          }}
        >
          <p className="text-sm">
            {t.account.codeSent} <strong>{email}</strong>.
          </p>
          <label className="text-sm">
            {t.account.code}
            <input
              className="field mt-1 tracking-widest"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={code.length < 6 || busy}>
            {busy ? t.account.verifying : t.account.verify}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setSent(false);
              setCode("");
              setError("");
            }}
          >
            {t.account.otherEmail}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-sm">{error}</p>}
    </div>
  );
}

function SignedIn({ email, onClose }: { email: string; onClose: () => void }) {
  const signOut = useAuth((s) => s.signOut);
  const { status, step, error, lastAt } = useSync();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const remove = async () => {
    setBusy(true);
    setDeleteError("");
    try {
      await deleteAccount();
      useAuth.setState({ user: null });
      onClose();
    } catch (e) {
      console.warn(e);
      setDeleteError(t.account.deleteError);
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <p className="text-sm text-muted">{t.account.signedAs}</p>
      <p className="break-all font-medium">{email}</p>
      <p className="mt-3 text-sm text-muted">
        {status === "syncing"
          ? `${t.account.syncing}${step ? ` ${t.account.uploading} ${step}` : ""}`
          : `${t.account.lastSync}: ${lastAt ? new Date(lastAt).toLocaleString("es") : t.account.never}`}
      </p>
      {status === "error" && error && <p className="mt-1 text-sm">{error}</p>}
      <p className="mt-3 text-xs text-muted">{t.account.limitNote}</p>

      <div className="mt-4 flex flex-col gap-2">
        <button className="btn" disabled={status === "syncing"} onClick={() => void syncAll()}>
          <RefreshCw size={18} className={status === "syncing" ? "animate-spin" : ""} /> {t.account.syncNow}
        </button>
        <button className="btn" onClick={() => void exportBackup()}>
          <Download size={18} /> {t.account.exportData}
        </button>
        <button
          className="btn"
          onClick={async () => {
            await signOut();
            onClose();
          }}
        >
          <LogOut size={18} /> {t.account.signOut}
        </button>
        {!confirming ? (
          <button className="btn" onClick={() => setConfirming(true)}>
            <Trash2 size={18} /> {t.account.deleteAccount}
          </button>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-sm">{t.account.deleteWarn}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" onClick={() => setConfirming(false)} disabled={busy}>
                {t.library.cancel}
              </button>
              <button className="btn btn-primary" onClick={() => void remove()} disabled={busy}>
                {t.account.deleteConfirm}
              </button>
            </div>
            {deleteError && <p className="mt-2 text-sm">{deleteError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
