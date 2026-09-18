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

const serverEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().optional().transform(sanitizeSupabaseUrl),
  SUPABASE_SECRET_KEY: z.string().optional().transform(sanitizeApiKey),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().transform(sanitizeApiKey),
  // Provider / Infrastructure secrets (all optional for foundation packet)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional().default("omnirank-private-assets"),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  APP_URL: z.string().optional().default("http://localhost:3000"),
  DEMO_MODE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return true;
      if (typeof val === "boolean") return val;
      const lower = val.toLowerCase().trim();
      return lower === "true" || lower === "1" || lower === "demo";
    }),
});

export function getServerEnv() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const rawSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const parsed = serverEnvSchema.parse({
    ...process.env,
    SUPABASE_URL: rawUrl,
    SUPABASE_SECRET_KEY: rawSecret,
  });
  const isProduction = parsed.NODE_ENV === "production";
  return {
    ...parsed,
    SUPABASE_SECRET_KEY: parsed.SUPABASE_SECRET_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY,
    // Demo mode is STRICTLY disabled in production
    DEMO_MODE: isProduction ? false : (parsed.DEMO_MODE ?? true),
  };
}
