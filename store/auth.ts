"use client";
import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface State {
  user: User | null;
  ready: boolean;
  init: () => void;
  /** devuelve un mensaje de error o null si salió bien */
  sendCode: (email: string) => Promise<string | null>;
  verify: (email: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

let started = false;

const explain = (e: { message?: string; status?: number }, fallback: string) =>
  e.status === 429 || /rate limit|too many/i.test(e.message ?? "")
    ? "Se pidieron demasiados códigos. Espera unos minutos e inténtalo de nuevo."
    : fallback;

export const useAuth = create<State>((set) => ({
  user: null,
  ready: false,
  init() {
    const c = supabase();
    if (!c || started) return;
    started = true;
    void c.auth.getSession().then(({ data }) => set({ user: data.session?.user ?? null, ready: true }));
    c.auth.onAuthStateChange((_e, s) => set({ user: s?.user ?? null, ready: true }));
  },
  async sendCode(email) {
    const c = supabase();
    if (!c) return "La sincronización no está configurada.";
    const { error } = await c.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    return error ? explain(error, "No se pudo enviar el código. Revisa el correo e inténtalo de nuevo.") : null;
  },
  async verify(email, code) {
    const c = supabase();
    if (!c) return "La sincronización no está configurada.";
    const { error } = await c.auth.verifyOtp({ email, token: code, type: "email" });
    return error ? explain(error, "El código no es válido o ya venció.") : null;
  },
  async signOut() {
    await supabase()?.auth.signOut({ scope: "local" });
    set({ user: null });
  },
}));
