import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils.ts";
import { clientEnv, sanitizeSupabaseUrl, sanitizeApiKey } from "../lib/env.ts";
import { supabase } from "../lib/supabase/client.ts";
import { r2Storage } from "../server/storage/r2.ts";
import { inngest } from "../server/inngest/client.ts";
import { getServerEnv } from "../server/env.ts";

describe("OR-P01 Foundation & Environment Tests", () => {
  it("should merge CSS class names safely using cn()", () => {
    const result = cn("bg-red-500", true && "text-white", false && "hidden", "p-4");
    expect(result).toBe("bg-red-500 text-white p-4");

    const overrideResult = cn("px-2 py-1", "px-4");
    expect(overrideResult).toBe("py-1 px-4");
  });

  it("should sanitize Supabase URLs to the project root without /rest/v1/", () => {
    expect(sanitizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe("https://abc.supabase.co");
    expect(sanitizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(sanitizeSupabaseUrl("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
    expect(sanitizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
    // Prefix assignment and quote resilience
    expect(sanitizeSupabaseUrl("VITE_SUPABASE_URL=https://abc.supabase.co")).toBe("https://abc.supabase.co");
    expect(sanitizeSupabaseUrl('"https://abc.supabase.co"')).toBe("https://abc.supabase.co");
    expect(sanitizeSupabaseUrl("'https://abc.supabase.co/'")).toBe("https://abc.supabase.co");
    expect(sanitizeApiKey("VITE_SUPABASE_PUBLISHABLE_KEY=abc-123")).toBe("abc-123");
    expect(sanitizeApiKey('"abc-123"')).toBe("abc-123");
  });

  it("should sanitize Supabase URL and validate publishable key on client without leaking secret keys", () => {
    expect(clientEnv).toBeDefined();
    expect(clientEnv.VITE_SUPABASE_URL).toBeDefined();
    expect(clientEnv.VITE_SUPABASE_URL.endsWith("/rest/v1")).toBe(false);
    expect(clientEnv.VITE_SUPABASE_PUBLISHABLE_KEY).toBeDefined();

    // Verify that server secret keys are NOT part of the client schema
    const clientKeys = Object.keys(clientEnv);
    expect(clientKeys).not.toContain("SUPABASE_SECRET_KEY");
    expect(clientKeys).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientKeys).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(clientKeys).not.toContain("OPENAI_API_KEY");
    expect(clientKeys).not.toContain("ANTHROPIC_API_KEY");
  });

  it("should allow server environment to parse cleanly with all optional provider keys omitted", () => {
    const serverEnv = getServerEnv();
    expect(serverEnv).toBeDefined();
    expect(typeof serverEnv.PORT).toBe("number");
    expect(serverEnv.PORT).toBeGreaterThan(0);
    // Optional provider credentials must not cause errors when omitted
    expect(serverEnv.R2_ACCOUNT_ID).toBeUndefined();
    expect(serverEnv.OPENAI_API_KEY).toBeUndefined();
    expect(serverEnv.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("should initialize browser Supabase client without runtime crash", () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe("function");
  });

  it("should initialize R2 storage service safely in stub mode without credentials", async () => {
    expect(r2Storage).toBeDefined();
    expect(r2Storage.isConfigured()).toBe(false);
    const upload = await r2Storage.uploadObject({
      key: "test/claim.txt",
      body: "Evidence Claim Test Data",
      contentType: "text/plain",
    });
    expect(upload.key).toBe("test/claim.txt");
    expect(upload.sizeBytes).toBeGreaterThan(0);
  });

  it("should initialize Inngest workflow client safely in development mode", async () => {
    expect(inngest.id).toBe("omnirank");
    const dispatch = await inngest.send({
      name: "omnirank/test.event",
      data: { test: true },
    });
    expect(dispatch.ids.length).toBe(1);
  });
});
