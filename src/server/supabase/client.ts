import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.ts";

export function getSupabasePublishableKey(): string {
  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  );
}

export function isLiveSupabaseConfigured(): boolean {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const hasValidUrl = url !== "" && !url.includes("placeholder.supabase.co");
  const pubKey = getSupabasePublishableKey();
  const hasValidPubKey = pubKey !== "" && !pubKey.includes("placeholder");
  return Boolean(hasValidUrl && hasValidPubKey && !env.DEMO_MODE);
}

export function createScopedUserSupabaseClient(accessToken?: string): SupabaseClient {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const pubKey = getSupabasePublishableKey() || "placeholder-publishable-key";

  const headers: Record<string, string> = {};
  if (accessToken && accessToken !== "demo-token" && !accessToken.startsWith("test-token-")) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return createClient(url, pubKey, {
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
