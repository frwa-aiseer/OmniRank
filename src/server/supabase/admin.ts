import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.ts";

export function createServerAdminSupabaseClient() {
  const env = getServerEnv();
  const url = env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    // In dev / test when service role is not configured, fall back to safe stub with warning
    console.warn("[OmniRank Server] SUPABASE_SERVICE_ROLE_KEY is not set. Service-level operations will be restricted.");
  }

  return createClient(url, key || "placeholder-service-key", {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
