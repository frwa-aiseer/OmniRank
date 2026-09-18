/// <reference types="vite/client" />
import { z } from "zod";

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "https://placeholder.supabase.co";
  let cleaned = rawUrl.trim().replace(/^["']|["']$/g, "").trim();
  if (cleaned.includes("=")) {
    const parts = cleaned.split("=");
    cleaned = parts[parts.length - 1].trim().replace(/^["']|["']$/g, "").trim();
  }
  const urlMatch = cleaned.match(/https?:\/\/[^\s"'`]+/);
  if (urlMatch) {
    cleaned = urlMatch[0];
  }
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  if (!cleaned || cleaned === "") return "https://placeholder.supabase.co";
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

export function sanitizeApiKey(rawKey?: string): string {
  if (!rawKey || typeof rawKey !== "string") return "";
  let cleaned = rawKey.trim().replace(/^["']|["']$/g, "").trim();
  if (cleaned.includes("=")) {
    const parts = cleaned.split("=");
    cleaned = parts[parts.length - 1].trim().replace(/^["']|["']$/g, "").trim();
  }
  return cleaned;
}

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().optional().default("https://placeholder.supabase.co").transform(sanitizeSupabaseUrl),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional().default("publishable-placeholder-key").transform(sanitizeApiKey),
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

export function isLiveBrowserSupabaseConfigured(): boolean {
  return (
    Boolean(clientEnv.VITE_SUPABASE_URL) &&
    !clientEnv.VITE_SUPABASE_URL.includes("placeholder.supabase.co") &&
    Boolean(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY) &&
    clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY !== "publishable-placeholder-key"
  );
}

