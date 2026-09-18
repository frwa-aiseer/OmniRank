import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.ts";

export function isLiveSupabaseConfigured(): boolean {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const hasValidUrl = url !== "" && !url.includes("placeholder.supabase.co");
  const hasKey = Boolean(env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  return hasValidUrl && hasKey && !env.DEMO_MODE;
}

export function createScopedUserSupabaseClient(accessToken?: string): SupabaseClient {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SECRET_KEY || "placeholder-anon-key";

  const headers: Record<string, string> = {};
  if (accessToken && accessToken !== "demo-token" && !accessToken.startsWith("test-token-")) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers,
    },
  });
}

export function getAdminSupabaseClient(): SupabaseClient {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || "placeholder-admin-key";

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
