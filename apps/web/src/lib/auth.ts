import { createClient } from "@supabase/supabase-js";
import type { AuthProvider } from "../types";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const configuredRedirectUrl = (import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined)?.trim();
const productionRedirectUrl = "https://scorexp.com";

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

  const redirectTo = authRedirectUrl();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo
    }
  });

  if (error) throw error;
}

function authRedirectUrl() {
  if (configuredRedirectUrl) return configuredRedirectUrl;
  if (typeof window === "undefined") return productionRedirectUrl;

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (isLocalhost && window.location.port !== "3000") {
    return `${window.location.origin}${window.location.pathname}`;
  }

  return productionRedirectUrl;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
