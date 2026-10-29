"use client";
import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { requestPersist } from "@/lib/db";
import { applyTheme } from "@/lib/themes";

/** Carga ajustes, sigue prefers-color-scheme, registra el service worker y pide almacenamiento persistente. */
export function Boot() {
  useEffect(() => {
    void useSettingsStore.getState().load();
    void requestPersist();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const s = useSettingsStore.getState();
      applyTheme({ ...s.global, ...(s.book ?? {}) });
    };
    mq.addEventListener("change", onChange);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
