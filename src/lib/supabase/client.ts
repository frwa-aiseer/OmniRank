import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "../env.ts";

export function createBrowserSupabaseClient() {
  return createClient(clientEnv.VITE_SUPABASE_URL, clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = createBrowserSupabaseClient();
