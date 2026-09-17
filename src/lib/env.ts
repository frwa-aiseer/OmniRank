/// <reference types="vite/client" />
import { z } from "zod";

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || rawUrl.trim() === "") return "https://placeholder.supabase.co";
  const cleaned = rawUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().optional().default("https://placeholder.supabase.co").transform(sanitizeSupabaseUrl),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional().default("publishable-placeholder-key"),
  APP_URL: z.string().optional().default("http://localhost:3000"),
});

export const clientEnv = clientEnvSchema.parse({
  VITE_SUPABASE_URL: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined,
  VITE_SUPABASE_PUBLISHABLE_KEY:
    (typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
      : undefined) || "publishable-placeholder-key",
  APP_URL: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.APP_URL : "http://localhost:3000",
});
