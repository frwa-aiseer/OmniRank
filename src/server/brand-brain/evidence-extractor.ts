import { EvidenceClaim, EvidenceClaimType, EvidenceClaimSourceLink } from "../../types/index.ts";
import { RawChunk } from "./chunker.ts";

export interface ExtractedEvidenceCandidate {
  claimText: string;
  claimType: EvidenceClaimType;
  confidenceScore: number;
  extractedEntities: Record<string, unknown>;
  exactQuote: string;
  pageOrSection?: string;
}

export class EvidenceExtractor {
  // Regex rules for numeric claims, benchmarks, statistics, and ROI outcomes
  private static readonly METRIC_PATTERNS: {
    regex: RegExp;
    type: EvidenceClaimType;
    confidence: number;
  }[] = [
    // Percentages and multipliers (e.g., 99.999% availability, 3.4x faster, 45% reduction)
    {
      regex: /(?:increased|reduced|improved|boosted|accelerated|achieved|lowered|grew|delivers?)\s+[^.!?\n]{0,80}?(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?x|\$\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:million|billion|k|M|B))?)/i,
      type: "statistic",
      confidence: 0.92
    },
    // Standalone strong percentages & stats
    {
      regex: /(?:\d+(?:\.\d+)?%|\d+(?:\.\d+)?x)\s+(?:faster|higher|lower|growth|efficiency|retention|accuracy|uptime|reduction|increase|availability)/i,
      type: "statistic",
      confidence: 0.90
    },
    // Dollar figures / ROI outcomes
    {
      regex: /\$\d+(?:,\d+)*(?:\.\d+)?(?:\s*(?:million|billion|M|B|k))?\s+(?:in\s+(?:savings|revenue|ARR|cost\s+reduction)|saved|generated|unlocked)/i,
      type: "customer_result",
      confidence: 0.88
    },
    // Latency and technical benchmark numbers (e.g., <10ms latency, 100,000 req/sec, sub-millisecond, latency is under 12ms)
    {
      regex: /(?:latency|throughput|response\s+time|p99|p95|uptime)\s+(?:(?:of|is|under|below|less\s+than|at|around)\s+)*(?:<|>|<=|>=)?\s*(?:\d+(?:\.\d+)?\s*(?:ms|seconds?|req\/s|tps|rps|qps|queries\/sec)|sub-millisecond|99\.\d+%\s*SLA|\d+(?:\.\d+)?%)/i,
      type: "benchmark",
      confidence: 0.94
    },
    // Compliance and certifications (e.g. SOC 2 Type II, HIPAA, ISO 27001, GDPR)
    {
      regex: /(?:SOC\s*2\s*Type\s*(?:I|II)|ISO\s*27001|HIPAA|GDPR|PCI-DSS|FedRAMP)\s*(?:certified|compliant|audited|certified\s+infrastructure)/i,
      type: "compliance",
      confidence: 0.95
    },
    // Pricing figures
    {
      regex: /(?:starting\s+at|priced\s+at|plans?\s+from)\s+\$\d+(?:\/\s*(?:mo|month|user|seat|year))?/i,
      type: "pricing",
      confidence: 0.85
    }
  ];

  /**
   * Scans chunks and extracts verifiable candidate evidence claims with provenance
   */
  static extractCandidatesFromChunk(
    chunk: RawChunk,
    documentId: string,
    sourceId: string,
    sourceName: string,
    sourceUrl?: string
  ): ExtractedEvidenceCandidate[] {
    const candidates: ExtractedEvidenceCandidate[] = [];
    const text = chunk.content;
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);

    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (cleanSentence.length < 20) continue;

      for (const pattern of this.METRIC_PATTERNS) {
        if (pattern.regex.test(cleanSentence)) {
          // Avoid duplicate claims in the same chunk
          if (!candidates.some((c) => c.claimText === cleanSentence)) {
            candidates.push({
              claimText: cleanSentence,
              claimType: pattern.type,
              confidenceScore: pattern.confidence,
              extractedEntities: {
                chunkIndex: chunk.chunkIndex,
                chunkType: chunk.chunkType,
                headings: chunk.headingHierarchy
              },
              exactQuote: cleanSentence,
              pageOrSection: chunk.headingHierarchy.join(" > ") || `Chunk #${chunk.chunkIndex}`
            });
          }
          break;
        }
      }
    }

    return candidates;
  }
}
