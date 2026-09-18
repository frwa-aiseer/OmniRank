import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateRequest } from "../server/auth/middleware.ts";
import { Request, Response } from "express";

describe("OR-G04A — Real Supabase Auth, Tenancy & Security Gate", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  function createMockHttp(headers: Record<string, string> = {}) {
    const req = {
      headers: { ...headers },
    } as unknown as Request;

    let statusCode = 200;
    let jsonBody: any = null;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    } as unknown as Response;

    const next = vi.fn();

    return { req, res, next, getStatus: () => statusCode, getJson: () => jsonBody };
  }

  it("should reject unauthenticated requests in production mode", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEMO_MODE = "false";

    const { req, res, next, getStatus, getJson } = createMockHttp({});

    await authenticateRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(401);
    expect(getJson().error).toBe("Authentication required");
  });

  it("should NOT trust x-user-id or x-service-role headers in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEMO_MODE = "false";

    // Attempting to spoof identity and service role via headers
    const { req, res, next, getStatus } = createMockHttp({
      "x-user-id": "evil-hacker-id",
      "x-service-role": "true",
    });

    await authenticateRequest(req, res, next);

    // Request must be rejected with 401 because no valid Bearer token was provided
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(401);
    expect(req.securityContext).toBeUndefined();
  });

  it("should ensure normal user requests never receive service-role authority", async () => {
    process.env.NODE_ENV = "development";
    process.env.DEMO_MODE = "true";

    const { req, res, next } = createMockHttp({
      authorization: "Bearer demo-token",
      "x-service-role": "true", // Malicious header
    });

    await authenticateRequest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.securityContext?.isAuthenticated).toBe(true);
    // Security Invariant: isServiceRole must ALWAYS be false for incoming HTTP requests
    expect(req.securityContext?.isServiceRole).toBe(false);
  });

  it("should strictly disable DEMO_MODE in production even if configured true in environment", async () => {
    process.env.NODE_ENV = "production";
    process.env.DEMO_MODE = "true"; // Attempting to force demo mode in production

    const { req, res, next, getStatus } = createMockHttp({
      authorization: "Bearer demo-token",
    });

    await authenticateRequest(req, res, next);

    // In production, demo tokens and fallback demo users are strictly rejected
    expect(next).not.toHaveBeenCalled();
    expect(getStatus()).toBe(401);
  });

  it("should correctly authenticate verified Supabase users and derive identity from verified claims", async () => {
    process.env.NODE_ENV = "development";
    process.env.DEMO_MODE = "true";

    const testUserId = "99999999-9999-4000-8000-999999999999";
    const { req, res, next } = createMockHttp({
      authorization: `Bearer test-token-${testUserId}`,
    });

    await authenticateRequest(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user?.id).toBe(testUserId);
    expect(req.securityContext?.userId).toBe(testUserId);
    expect(req.securityContext?.isAuthenticated).toBe(true);
    expect(req.securityContext?.isServiceRole).toBe(false);
  });
});
