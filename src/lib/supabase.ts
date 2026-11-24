import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key && !url.includes("YOUR_PROJECT_ID") && !key.includes("YOUR_SUPABASE"));
const rememberUntilKey = "hrration-remember-until";
const authStorage = {
  getItem(key: string) {
    const expiry = Number(window.localStorage.getItem(rememberUntilKey) || 0);
    if (expiry > Date.now()) return window.localStorage.getItem(key);
    window.localStorage.removeItem(key);
    return window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    const expiry = Number(window.localStorage.getItem(rememberUntilKey) || 0);
    if (expiry > Date.now()) window.localStorage.setItem(key, value);
    else window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(url!, key!, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;