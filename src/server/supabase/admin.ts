import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.ts";

export function createServerAdminSupabaseClient() {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.SUPABASE_SECRET_KEY;

  if (!key) {
    // In dev / test when secret key is not configured, fall back to safe stub with warning
    console.warn("[OmniRank Server] SUPABASE_SECRET_KEY is not set. Service-level operations will be restricted.");
  }

  return createClient(url, key || "placeholder-secret-key", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
