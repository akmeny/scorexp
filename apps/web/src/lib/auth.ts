import { createClient } from "@supabase/supabase-js";
import type { AuthProvider } from "../types";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = authConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    })
  : null;

export const authProviders: { provider: AuthProvider; label: string }[] = [
  { provider: "google", label: "Google ile giriş" },
  { provider: "apple", label: "Apple ile giriş" },
  { provider: "facebook", label: "Facebook ile giriş" },
  { provider: "x", label: "X ile giriş" }
];

export async function signInWithProvider(provider: AuthProvider) {
  if (!supabase) throw new Error("Auth is not configured");

  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
