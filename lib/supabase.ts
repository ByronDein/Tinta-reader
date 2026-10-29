import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** La sincronización es opcional: sin variables de entorno la app funciona solo en local. */
export const cloudEnabled = !!(url && key);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  if (!cloudEnabled || typeof window === "undefined") return null;
  client ??= createClient(url!, key!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
