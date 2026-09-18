import { Request, Response, NextFunction } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.ts";
import { createServerAdminSupabaseClient } from "../supabase/admin.ts";
import { createScopedUserSupabaseClient } from "../supabase/client.ts";
import { SecurityContext } from "./tenancy.ts";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  fullName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      securityContext?: SecurityContext;
      token?: string;
      supabaseClient?: SupabaseClient;
    }
  }
}

/**
 * Shared Express Authentication Middleware (OR-G04A)
 *
 * Security Invariants:
 * 1. Reads `Authorization: Bearer <access_token>`.
 * 2. In production (`NODE_ENV === "production"`):
 *    - Never trusts `x-user-id` or `x-service-role` request headers.
 *    - Never determines user identity by slicing or interpreting unverified tokens.
 *    - Validates Supabase JWT using Supabase Auth (`supabaseAdmin.auth.getUser(token)`).
 *    - Derives user ID and context ONLY from verified Supabase Auth user data.
 *    - Rejects unauthenticated / invalid requests with 401 Unauthorized.
 * 3. Normal user requests NEVER receive service-role authority (`isServiceRole: false`).
 * 4. Development-only DEMO_MODE:
 *    - Demo fallback authentication works ONLY when `DEMO_MODE === true` AND `NODE_ENV !== "production"`.
 */
export async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const env = getServerEnv();
  const authHeader = req.headers.authorization;
  const isProduction = env.NODE_ENV === "production";
  const isDemoMode = !isProduction && Boolean(env.DEMO_MODE);

  // Strip and reject any client attempts to forge service-role authority via headers
  // Normal incoming requests NEVER receive service-role context.

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (isDemoMode) {
      // In explicit local development demo mode without auth header, provide standard demo user
      req.user = {
        id: "00000000-0000-4000-8000-000000000001",
        email: "alex@omnirank.ai",
        fullName: "Alex Rivera",
      };
      req.securityContext = {
        userId: req.user.id,
        isAuthenticated: true,
        isServiceRole: false, // Normal user request - NEVER service role
      };
      return next();
    }

    res.status(401).json({
      error: "Authentication required",
      message: "Missing or malformed Authorization header. Expected: Bearer <access_token>",
    });
    return;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    res.status(401).json({
      error: "Invalid token",
      message: "Empty Bearer token provided",
    });
    return;
  }

  req.token = token;
  req.supabaseClient = createScopedUserSupabaseClient(token);

  // Handle explicit demo/test tokens ONLY in development demo mode
  if (isDemoMode) {
    if (token === "demo-token" || token.startsWith("test-token-")) {
      const demoUserId = token.startsWith("test-token-")
        ? token.replace("test-token-", "")
        : "00000000-0000-4000-8000-000000000001";

      req.user = {
        id: demoUserId,
        email: `${demoUserId.slice(0, 8)}@omnirank.ai`,
        fullName: "Demo User",
      };
      req.securityContext = {
        userId: demoUserId,
        isAuthenticated: true,
        isServiceRole: false, // Normal user request - NEVER service role
      };
      return next();
    }
  }

  // Supabase Auth JWT Verification
  try {
    const adminSupabase = createServerAdminSupabaseClient();
    const { data, error } = await adminSupabase.auth.getUser(token);

    if (error || !data.user) {
      if (isDemoMode) {
        // Fallback for development if placeholder Supabase instance is active
        req.user = {
          id: "00000000-0000-4000-8000-000000000001",
          email: "alex@omnirank.ai",
          fullName: "Alex Rivera",
        };
        req.securityContext = {
          userId: req.user.id,
          isAuthenticated: true,
          isServiceRole: false,
        };
        return next();
      }

      res.status(401).json({
        error: "Unauthorized",
        message: error?.message || "Invalid or expired authorization token",
      });
      return;
    }

    // Verified Supabase user
    req.user = {
      id: data.user.id,
      email: data.user.email,
      fullName: (data.user.user_metadata?.full_name as string) || data.user.email,
    };
    req.securityContext = {
      userId: data.user.id,
      isAuthenticated: true,
      isServiceRole: false, // Normal user request - NEVER service role
    };

    return next();
  } catch (err: any) {
    if (isDemoMode) {
      req.user = {
        id: "00000000-0000-4000-8000-000000000001",
        email: "alex@omnirank.ai",
        fullName: "Alex Rivera",
      };
      req.securityContext = {
        userId: req.user.id,
        isAuthenticated: true,
        isServiceRole: false,
      };
      return next();
    }

    res.status(401).json({
      error: "Authentication verification failed",
      message: err.message,
    });
    return;
  }
}
