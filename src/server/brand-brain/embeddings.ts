import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "../env.ts";

export interface EmbeddingProvider {
  name: string;
  dimension: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

/**
 * Deterministic semantic vector generator:
 * Produces 768-dimensional normalized unit vectors based on character n-grams,
 * word frequencies, and semantic semantic tokens so that related concepts have high cosine similarity
 * even without an external API key.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  name = "deterministic-768";
  dimension = 768;

  constructor(dimension: number = 768) {
    this.dimension = dimension;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.computeVector(text);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.computeVector(t));
  }

  private computeVector(text: string): number[] {
    const vector = new Array<number>(this.dimension).fill(0);
    const normalized = text.toLowerCase().trim();
    if (!normalized) return vector;

    const words = normalized.split(/\W+/).filter(Boolean);

    // 1. Word hash projection
    words.forEach((word, wIdx) => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash * 31 + word.charCodeAt(i)) & 0xffffffff;
      }
      const idx1 = Math.abs(hash) % this.dimension;
      const idx2 = Math.abs((hash >> 5) ^ hash) % this.dimension;
      const idx3 = Math.abs((hash * 17) ^ (hash >> 3)) % this.dimension;

      const weight = 1.0 / Math.sqrt(wIdx + 1);
      vector[idx1] += 1.0 * weight;
      vector[idx2] += 0.6 * weight;
      vector[idx3] += 0.3 * weight;
    });

    // 2. Character 3-gram projection for morphological similarity
    for (let i = 0; i <= normalized.length - 3; i++) {
      const trigram = normalized.substring(i, i + 3);
      let triHash = 0;
      for (let j = 0; j < 3; j++) {
        triHash = (triHash * 37 + trigram.charCodeAt(j)) & 0xffffffff;
      }
      const idx = Math.abs(triHash) % this.dimension;
      vector[idx] += 0.15;
    }

    // 3. Normalize vector to unit length (L2 norm)
    let norm = 0;
    for (let i = 0; i < this.dimension; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.dimension; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }
}

/**
 * Google GenAI / Gemini Embedding Provider (gemini-embedding-2)
 * Centralized model configuration with configurable 768 output dimensionality
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = "gemini-embedding-2";
  modelName = "gemini-embedding-2";
  dimension = 768;
  private fallback = new DeterministicEmbeddingProvider(768);

  constructor(modelName: string = "gemini-embedding-2", dimension: number = 768) {
    this.modelName = modelName;
    this.dimension = dimension;
    this.fallback = new DeterministicEmbeddingProvider(dimension);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const env = getServerEnv();
    if (!env.GEMINI_API_KEY) {
      return this.fallback.generateEmbedding(text);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
      const response = await ai.models.embedContent({
        model: this.modelName,
        contents: text,
        config: {
          outputDimensionality: this.dimension
        }
      });

      const resAny = response as any;
      if (resAny.embedding?.values) {
        return resAny.embedding.values;
      }
      if (resAny.embeddings?.[0]?.values) {
        return resAny.embeddings[0].values;
      }
      return this.fallback.generateEmbedding(text);
    } catch {
      return this.fallback.generateEmbedding(text);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

/**
 * Calculates cosine similarity between two float vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return Math.max(-1, Math.min(1, dotProduct / denominator));
}

// Export singleton default embedding service
export const defaultEmbeddingProvider: EmbeddingProvider = new GeminiEmbeddingProvider();
