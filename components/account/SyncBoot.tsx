"use client";
import { useEffect } from "react";
import { cloudEnabled } from "@/lib/supabase";
import { initSync, syncAll } from "@/lib/sync";
import { useAuth } from "@/store/auth";

/** Arranca la sesión y la sincronización (solo si Supabase está configurado). */
export function SyncBoot() {
  useEffect(() => {
    if (!cloudEnabled) return;
    useAuth.getState().init();
    const stop = initSync();
    const off = useAuth.subscribe((s, prev) => {
      if (s.user && s.user.id !== prev.user?.id) void syncAll();
    });
    if (useAuth.getState().user) void syncAll();
    return () => {
      stop();
      off();
    };
  }, []);
  return null;
}
