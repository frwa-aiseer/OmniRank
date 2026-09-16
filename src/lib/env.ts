/// <reference types="vite/client" />
import { z } from "zod";

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional().default("https://placeholder.supabase.co"),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional().default("anon-placeholder-key"),
  APP_URL: z.string().optional().default("http://localhost:3000"),
});

export const clientEnv = clientEnvSchema.parse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  APP_URL: import.meta.env.APP_URL,
});
