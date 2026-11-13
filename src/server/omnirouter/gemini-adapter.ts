/**
 * OR-P08 — Gemini Provider Adapter
 *
 * All provider-specific logic is isolated here.
 * The rest of the application never imports this directly — only OmniRouter does.
 * API keys are read from server env only; never logged or exposed.
 */

import { getServerEnv } from "../env.ts";
import type { RouterRequest, RouterResponse } from "../../types/omnirouter.ts";

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message: string; code: number };
}

export async function callGemini(
  modelId: string,
  request: RouterRequest,
  timeoutMs: number
): Promise<RouterResponse> {
  const start = Date.now();
  const env = getServerEnv();

  if (!env.GEMINI_API_KEY) {
    return {
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      modelUsed: modelId,
      taskCode: request.taskCode,
      error: "GEMINI_API_KEY not configured",
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${env.GEMINI_API_KEY}`;

  const contents: GeminiContent[] = [
    { role: "user", parts: [{ text: request.userPrompt }] },
  ];

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: request.systemPrompt
      ? { parts: [{ text: request.systemPrompt }] }
      : undefined,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
      ...(request.structuredOutput
        ? { responseMimeType: "application/json" }
        : {}),
    },
  };

  let responseText = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let raw: Response;
    try {
      raw = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const json: GeminiResponse = await raw.json();

    if (json.error) {
      return {
        success: false,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        modelUsed: modelId,
        taskCode: request.taskCode,
        error: `Gemini API error ${json.error.code}: ${json.error.message}`,
      };
    }

    responseText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
    outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      modelUsed: modelId,
      taskCode: request.taskCode,
      error: msg.includes("abort") ? "Request timed out" : msg,
    };
  }

  let structured: Record<string, unknown> | undefined;
  if (request.structuredOutput && responseText) {
    try {
      // Strip markdown code fences if present
      const cleaned = responseText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      structured = JSON.parse(cleaned);
    } catch {
      // Return raw text even if structured parse fails
    }
  }

  return {
    success: true,
    text: responseText,
    structured,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - start,
    modelUsed: modelId,
    taskCode: request.taskCode,
  };
}
