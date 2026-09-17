import { createHash } from "crypto";
import { ChunkType } from "../../types/index.ts";

export interface RawChunk {
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  headingHierarchy: string[];
  chunkType: ChunkType;
  metadata: Record<string, unknown>;
}

export class SemanticChunker {
  private maxTokensPerChunk: number;
  private chunkOverlapTokens: number;

  constructor(maxTokens = 400, overlapTokens = 50) {
    this.maxTokensPerChunk = maxTokens;
    this.chunkOverlapTokens = overlapTokens;
  }

  /**
   * Estimates token count (approx 1 token = 4 chars or 0.75 words)
   */
  static estimateTokenCount(text: string): number {
    return Math.max(1, Math.ceil(text.trim().length / 4));
  }

  /**
   * Splits structured text into semantic, token-bounded chunks while tracking heading hierarchies
   */
  chunkDocument(text: string, baseMetadata: Record<string, unknown> = {}): RawChunk[] {
    const rawLines = text.split(/\r?\n/);
    const chunks: RawChunk[] = [];
    let currentHeadingStack: { level: number; text: string }[] = [];
    let currentBlockLines: string[] = [];
    let currentBlockTokens = 0;
    let chunkIndex = 0;

    const flushBlock = (typeOverride?: ChunkType) => {
      if (currentBlockLines.length === 0) return;
      const content = currentBlockLines.join("\n").trim();
      if (!content) return;

      const tokenCount = SemanticChunker.estimateTokenCount(content);
      const headingHierarchy = currentHeadingStack.map((h) => h.text);
      const chunkType = typeOverride || this.detectChunkType(content);
      const contentHash = createHash("sha256").update(content).digest("hex");

      chunks.push({
        chunkIndex: chunkIndex++,
        content,
        contentHash,
        tokenCount,
        headingHierarchy,
        chunkType,
        metadata: {
          ...baseMetadata,
          headingsCount: headingHierarchy.length
        }
      });

      // Retain slight overlap if block was large
      if (currentBlockLines.length > 3 && this.chunkOverlapTokens > 0) {
        currentBlockLines = currentBlockLines.slice(-2);
        currentBlockTokens = SemanticChunker.estimateTokenCount(currentBlockLines.join("\n"));
      } else {
        currentBlockLines = [];
        currentBlockTokens = 0;
      }
    };

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Check for Markdown headings: #, ##, ###, ####
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();

        // Flush existing block before new section
        if (currentBlockLines.length > 0) {
          flushBlock();
        }

        // Update heading stack: remove headings at current level or deeper
        currentHeadingStack = currentHeadingStack.filter((h) => h.level < level);
        currentHeadingStack.push({ level, text: headingText });
        continue;
      }

      // Check for Table rows (| col | col |)
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        currentBlockLines.push(line);
        currentBlockTokens += SemanticChunker.estimateTokenCount(line);
        // If next line is not table, flush as table chunk
        const nextLine = rawLines[i + 1]?.trim() || "";
        if (!nextLine.startsWith("|")) {
          flushBlock("table");
        }
        continue;
      }

      // Check for Code block
      if (trimmed.startsWith("```")) {
        currentBlockLines.push(line);
        currentBlockTokens += SemanticChunker.estimateTokenCount(line);
        if (currentBlockLines.filter((l) => l.trim().startsWith("```")).length >= 2) {
          flushBlock("code");
        }
        continue;
      }

      // Normal text line
      if (trimmed.length > 0) {
        currentBlockLines.push(line);
        currentBlockTokens += SemanticChunker.estimateTokenCount(line);
      } else if (currentBlockLines.length > 0) {
        // Empty line represents paragraph boundary
        if (currentBlockTokens >= this.maxTokensPerChunk * 0.7) {
          flushBlock();
        }
      }

      // Hard max token overflow guard
      if (currentBlockTokens >= this.maxTokensPerChunk) {
        flushBlock();
      }
    }

    // Flush any remaining lines
    if (currentBlockLines.length > 0) {
      flushBlock();
    }

    // If text was empty or had no valid blocks, ensure at least 1 fallback chunk if text has length
    if (chunks.length === 0 && text.trim().length > 0) {
      const trimmed = text.trim();
      chunks.push({
        chunkIndex: 0,
        content: trimmed,
        contentHash: createHash("sha256").update(trimmed).digest("hex"),
        tokenCount: SemanticChunker.estimateTokenCount(trimmed),
        headingHierarchy: [],
        chunkType: "text",
        metadata: baseMetadata
      });
    }

    return chunks;
  }

  private detectChunkType(content: string): ChunkType {
    const trimmed = content.trim();
    if (trimmed.startsWith("|") && trimmed.includes("\n|")) return "table";
    if (trimmed.startsWith("```") && trimmed.endsWith("```")) return "code";
    if (/^[*\-•]\s+/m.test(trimmed) || /^\d+\.\s+/m.test(trimmed)) return "list";
    if (trimmed.startsWith(">") || /^["'].+["']$/s.test(trimmed)) return "quote";
    if (/^Q:\s+|^Question:\s+/im.test(trimmed)) return "qa";
    return "text";
  }
}
