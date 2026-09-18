import { z } from "zod";

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl || rawUrl.trim() === "") return "https://placeholder.supabase.co";
  const cleaned = rawUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

const serverEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().optional().transform(sanitizeSupabaseUrl),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
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
  const parsed = serverEnvSchema.parse(process.env);
  const isProduction = parsed.NODE_ENV === "production";
  return {
    ...parsed,
    SUPABASE_SECRET_KEY: parsed.SUPABASE_SECRET_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY,
    // Demo mode is STRICTLY disabled in production
    DEMO_MODE: isProduction ? false : (parsed.DEMO_MODE ?? true),
  };
}
