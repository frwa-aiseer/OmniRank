import { createHash } from "crypto";

export interface SanitizationResult {
  cleanText: string;
  hasUntrustedDirectives: boolean;
  sanitizationNotes: string[];
}

/**
 * ContentSanitizer
 *
 * ARCHITECTURAL SECURITY MODEL:
 * Pattern matching and script stripping in this class are strictly DEFENSE-IN-DEPTH heuristics,
 * NOT a primary security boundary. Attackers can devise unlimited prompt injection variants.
 *
 * OmniRank's true security boundary is architectural:
 * 1. Data Classification: All crawled web content, uploaded documents, and imported data are
 *    strictly classified as UNTRUSTED DATA and isolated to passive research context only.
 *    Untrusted data MUST NEVER be placed into system instructions or given execution authority.
 * 2. Execution Separation: AI models may propose actions, but all consequential operations
 *    (e.g., publishing, block updates, policy modifications, database writes) MUST pass through:
 *    [AI Proposal] -> [Policy Gateway] -> [Permission Check (RBAC/RLS)] -> [Human Approval Check] -> [Trusted Application Executor].
 *
 * This sanitizer provides early triage:
 * - Strips dangerous executable script tags and pseudo-protocols
 * - Neutralizes spreadsheet formula injection (DDE/exec macros)
 * - Flags suspicious instruction-override patterns for audit logging
 * - Normalizes zero-width and control characters
 */
export class ContentSanitizer {
  // Common prompt injection, system override, and adversarial patterns
  private static readonly ADVERSARIAL_PATTERNS: { regex: RegExp; description: string }[] = [
    { regex: /SYSTEM\s+OVERRIDE[:\s]/i, description: "System override directive detected" },
    { regex: /Ignore\s+(all\s+)?previous\s+instructions/i, description: "Instruction bypass attempt detected" },
    { regex: /Disregard\s+(the\s+)?(above|prior)\s+rules/i, description: "Prior rules disregard attempt detected" },
    { regex: /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/i, description: "Raw LLM prompt framing token detected" },
    { regex: /<script[\s\S]*?>[\s\S]*?<\/script>/gi, description: "Embedded executable HTML script tag detected" },
    { regex: /javascript:[^\s"'>]+/gi, description: "JavaScript pseudo-protocol URI detected" },
    { regex: /=(?:cmd|system|dde)\s*\|/i, description: "Dangerous spreadsheet DDE macro execution detected" },
    { regex: /powershell|cmd\.exe|\/bin\/sh|\/bin\/bash/i, description: "Direct shell execution string detected in untrusted content" }
  ];

  /**
   * Sanitizes untrusted content:
   * 1. Strips dangerous HTML/executable script tags
   * 2. Neutralizes spreadsheet formula macros
   * 3. Detects & annotates adversarial prompt injection strings
   * 4. Normalizes unicode, zero-width characters, and spacing
   */
  static sanitize(rawText: string): SanitizationResult {
    let text = rawText || "";
    const notes: string[] = [];
    let hasUntrustedDirectives = false;

    // Remove zero-width spaces and non-printable control characters (except standard newlines and tabs)
    text = text.replace(/[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

    // Check for adversarial prompt patterns
    for (const pattern of this.ADVERSARIAL_PATTERNS) {
      if (pattern.regex.test(text)) {
        hasUntrustedDirectives = true;
        notes.push(pattern.description);
      }
    }

    // Strip executable HTML script and style tags
    text = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, (match) => {
      notes.push(`Stripped executable script block (${match.length} chars)`);
      return "[STRIPPED_UNTRUSTED_SCRIPT]";
    });
    text = text.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

    // Neutralize dangerous spreadsheet formulas starting with =, +, -, @ if followed by shell commands
    text = text.replace(/^([=+\-@])\s*(cmd|system|dde|exec|shell)\b/gim, (_, prefix, cmd) => {
      notes.push(`Neutralized spreadsheet command invocation: ${prefix}${cmd}`);
      return `'${prefix}${cmd}`;
    });

    // Normalize Windows CRLF to LF and multiple blank lines
    text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return {
      cleanText: text,
      hasUntrustedDirectives,
      sanitizationNotes: notes
    };
  }

  /**
   * Generates a deterministic SHA-256 hash for deduplication
   */
  static computeContentHash(content: string | Uint8Array): string {
    const hash = createHash("sha256");
    if (typeof content === "string") {
      hash.update(content.trim(), "utf8");
    } else {
      hash.update(content);
    }
    return hash.digest("hex");
  }
}
