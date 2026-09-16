import { describe, it, expect } from "vitest";
import { cn } from "../lib/utils.ts";
import { clientEnv } from "../lib/env.ts";
import { supabase } from "../lib/supabase/client.ts";
import { r2Storage } from "../server/storage/r2.ts";
import { inngest } from "../server/inngest/client.ts";

describe("OR-P01 Foundation Tests", () => {
  it("should merge CSS class names safely using cn()", () => {
    const result = cn("bg-red-500", true && "text-white", false && "hidden", "p-4");
    expect(result).toBe("bg-red-500 text-white p-4");

    const overrideResult = cn("px-2 py-1", "px-4");
    expect(overrideResult).toBe("py-1 px-4");
  });

  it("should validate client environment schema without leaking server keys", () => {
    expect(clientEnv).toBeDefined();
    expect(clientEnv.VITE_SUPABASE_URL).toBeDefined();
    // Verify that server secrets are NOT part of the client schema
    expect((clientEnv as unknown as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect((clientEnv as unknown as Record<string, unknown>).R2_SECRET_ACCESS_KEY).toBeUndefined();
  });

  it("should initialize browser Supabase client without runtime crash", () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe("function");
  });

  it("should initialize R2 storage service safely", async () => {
    expect(r2Storage).toBeDefined();
    const upload = await r2Storage.uploadObject({
      key: "test/claim.txt",
      body: "Evidence Claim Test Data",
      contentType: "text/plain",
    });
    expect(upload.key).toBe("test/claim.txt");
    expect(upload.sizeBytes).toBeGreaterThan(0);
  });

  it("should initialize Inngest workflow client safely", async () => {
    expect(inngest.id).toBe("omnirank");
    const dispatch = await inngest.send({
      name: "omnirank/test.event",
      data: { test: true },
    });
    expect(dispatch.ids.length).toBe(1);
  });
});
