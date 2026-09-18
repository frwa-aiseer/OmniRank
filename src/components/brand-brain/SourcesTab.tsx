import React, { useState } from "react";
import {
  UploadCloud,
  Globe,
  FileText,
  Table,
  Search,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  Layers,
  Sparkles,
  Trash2,
  Eye,
  CheckCircle2,
  ExternalLink,
  Lock
} from "lucide-react";
import {
  KnowledgeSource,
  KnowledgeDocument,
  KnowledgeChunk,
  SemanticSearchResult,
  TrustLevel,
  DocumentClassification
} from "../../types/index.ts";

interface SourcesTabProps {
  brandId: string;
  sources: KnowledgeSource[];
  documents: KnowledgeDocument[];
  isStrategistOrAdmin: boolean;
  isWriterOrAbove: boolean;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export function SourcesTab({
  brandId,
  sources,
  documents,
  isStrategistOrAdmin,
  isWriterOrAbove,
  onRefresh,
  onNotify
}: SourcesTabProps) {
  // Modal / Form state
  const [ingestionType, setIngestionType] = useState<"file" | "url" | "note">("file");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>("verified_1p");
  const [classification, setClassification] = useState<DocumentClassification>("general");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inspector & Search state
  const [selectedDocForChunks, setSelectedDocForChunks] = useState<KnowledgeDocument | null>(null);
  const [docChunks, setDocChunks] = useState<KnowledgeChunk[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Semantic Retrieval Test Sandbox
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!sourceName) {
        setSourceName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWriterOrAbove) {
      onNotify("Permission denied: Strategist or Writer role required.");
      return;
    }

    setIsSubmitting(true);
    try {
      let res: Response;

      if (ingestionType === "file" && selectedFile) {
        // Binary upload via FormData without converting PDF/DOCX/XLSX to strings
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("sourceName", sourceName || selectedFile.name.replace(/\.[^/.]+$/, ""));
        formData.append("trustLevel", trustLevel);
        formData.append("classification", classification);

        res = await fetch(`/api/brand-brain/${brandId}/upload`, {
          method: "POST",
          body: formData
        });
      } else {
        let content = rawText;
        let fileType: any = "txt";

        if (ingestionType === "url") {
          fileType = "html";
        } else if (ingestionType === "note") {
          fileType = "note";
        }

        res = await fetch(`/api/brand-brain/${brandId}/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceType: ingestionType === "url" ? "website" : "manual_note",
            sourceName: sourceName || (ingestionType === "url" ? sourceUrl : "Manual Note"),
            sourceUrl: sourceUrl || undefined,
            fileType,
            content,
            trustLevel,
            classification
          })
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Ingestion failed");
      }

      const result = await res.json();
      if (result.isDuplicate) {
        onNotify(`Document is already indexed (Content hash matched). No re-embedding needed.`);
      } else if (result.sanitizationApplied) {
        onNotify(`Document parsed & sanitized: Untrusted directives/scripts neutralized.`);
      } else {
        onNotify(`Successfully ingested '${result.document.title}' into ${result.chunks.length} semantic chunks!`);
      }

      // Reset form
      setSourceName("");
      setSourceUrl("");
      setRawText("");
      setSelectedFile(null);
      onRefresh();
    } catch (err: any) {
      onNotify(`Error ingesting content: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewChunks = async (doc: KnowledgeDocument) => {
    setSelectedDocForChunks(doc);
    setLoadingChunks(true);
    try {
      const res = await fetch(`/api/brand-brain/${brandId}/chunks?documentId=${doc.id}`);
      if (res.ok) {
        const data = await res.json();
        setDocChunks(data.chunks || []);
      }
    } catch {
      setDocChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!isStrategistOrAdmin) {
      onNotify("Permission denied: Strategist role required to delete documents.");
      return;
    }
    if (!confirm("Are you sure you want to remove this document and its semantic chunks?")) return;

    try {
      const res = await fetch(`/api/brand-brain/${brandId}/documents/${docId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        onNotify("Document and associated chunks deleted.");
        if (selectedDocForChunks?.id === docId) setSelectedDocForChunks(null);
        onRefresh();
      }
    } catch (err: any) {
      onNotify(`Failed to delete document: ${err.message}`);
    }
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/brand-brain/${brandId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, topK: 4, minSimilarity: 0.1 })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err: any) {
      onNotify(`Search error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Ingestion Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Knowledge Ingestion Pipeline
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Ingest whitepapers, PDFs, spreadsheets, Markdown docs, and websites. Automatically chunked, embedded with pgvector, and protected against adversarial instructions.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setIngestionType("file")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                ingestionType === "file" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              File Upload
            </button>
            <button
              type="button"
              onClick={() => setIngestionType("url")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                ingestionType === "url" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              URL / Website
            </button>
            <button
              type="button"
              onClick={() => setIngestionType("note")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                ingestionType === "note" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Manual Note
            </button>
          </div>
        </div>

        {/* Ingestion Form */}
        <form onSubmit={handleIngest} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source / Document Name *</label>
              <input
                type="text"
                required
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Acme Architecture Whitepaper 2026"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trust Level Taxonomy</label>
              <select
                value={trustLevel}
                onChange={(e) => setTrustLevel(e.target.value as TrustLevel)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="brand_authoritative">Brand Authoritative (Official 1st-Party)</option>
                <option value="external_authoritative">External Authoritative (.gov / .edu / institutional)</option>
                <option value="partner">Partner (Ecosystem / Integration)</option>
                <option value="competitor">Competitor (Comparative Intel)</option>
                <option value="unverified_external">Unverified External (General 3rd-Party)</option>
                <option value="untrusted_crawl">Untrusted / Public Web Crawl</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="general">General Knowledge</option>
                <option value="product_doc">Product Specification</option>
                <option value="technical_spec">Technical Architecture</option>
                <option value="customer_story">Customer Case Study</option>
                <option value="whitepaper">Whitepaper / Research</option>
                <option value="policy">Policy / Compliance</option>
                <option value="competitor_review">Competitor Matrix</option>
              </select>
            </div>
          </div>

          {ingestionType === "file" && (
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                id="file-upload"
                accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.html"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
                <UploadCloud className="w-10 h-10 text-indigo-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : "Click to select or drag & drop a file"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported: PDF, DOCX, TXT, Markdown, CSV, XLSX, HTML (Max 25MB)
                </p>
              </label>
            </div>
          )}

          {ingestionType === "url" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website URL to Ingest *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="url"
                    required
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://acmecloud.ai/docs/architecture"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {(ingestionType === "note" || (ingestionType === "file" && !selectedFile)) && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {ingestionType === "note" ? "Manual Note Content *" : "Or Paste Direct Text / Markdown"}
              </label>
              <textarea
                rows={4}
                required={ingestionType === "note"}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="# Architecture Overview&#10;Acme Cloud delivers 99.999% uptime..."
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !isWriterOrAbove}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {isSubmitting ? "Ingesting & Embedding..." : "Ingest into Brand Brain"}
            </button>
          </div>
        </form>
      </div>

      {/* Semantic Retrieval Test Sandbox */}
      <div className="bg-gradient-to-br from-indigo-50/70 to-slate-50 border border-indigo-100 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              Test Semantic Vector Retrieval (pgvector Sandbox)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Query Brand Brain embeddings in real-time. Verified strict brand-isolation prevents any cross-tenant data leakage.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Brand Isolation Enforced
          </span>
        </div>

        <form onSubmit={handleSemanticSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="e.g. latency bounds, SLA guarantee, 99.999% availability, cost savings..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            {isSearching ? "Searching..." : "Search Chunks"}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Top Semantic Matches</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((res, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-indigo-700 truncate">{res.documentTitle}</span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {(res.similarityScore * 100).toFixed(1)}% match
                    </span>
                  </div>
                  {res.chunk.headingHierarchy.length > 0 && (
                    <p className="text-[11px] text-slate-500 font-medium mb-1">
                      {res.chunk.headingHierarchy.join(" > ")}
                    </p>
                  )}
                  <p className="text-xs text-slate-700 font-mono bg-slate-50 p-2 rounded border border-slate-100 line-clamp-3">
                    {res.chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents & Ingested Knowledge Sources */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-600" />
              Ingested Documents & Knowledge Store ({documents.length})
            </h3>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No documents ingested yet</p>
            <p className="text-xs text-slate-500 mt-1">Upload a PDF, Markdown file or web page to populate Brand Brain.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {documents.map((doc) => (
              <div key={doc.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">{doc.title}</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                      v{doc.revision || 1}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {doc.fileType}
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                      {doc.trustLevel.replace("_", " ")}
                    </span>
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                      {doc.classification.replace("_", " ")}
                    </span>
                    {doc.hasUntrustedDirectives && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium" title={doc.sanitizationNotes.join(", ")}>
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Sanitized Directives
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex items-center gap-3">
                    <span>{doc.chunkCount} semantic chunks</span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">Hash: {doc.contentHash.slice(0, 12)}...</span>
                    <span>•</span>
                    <span>Ingested {new Date(doc.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleViewChunks(doc)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Chunks
                  </button>
                  {isStrategistOrAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete document and chunks"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chunks Inspector Modal / Drawer */}
      {selectedDocForChunks && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                Chunk Inspector: {selectedDocForChunks.title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {docChunks.length} chunks • 768-dim normalized embedding vectors
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDocForChunks(null)}
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer"
            >
              Close
            </button>
          </div>

          {loadingChunks ? (
            <p className="text-xs text-slate-400 py-4">Loading vector chunks...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-1">
              {docChunks.map((chk) => (
                <div key={chk.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-indigo-400 font-semibold">Chunk #{chk.chunkIndex + 1}</span>
                    <span className="text-[10px] text-slate-400 font-mono">~{chk.tokenCount} tokens</span>
                  </div>
                  {chk.headingHierarchy.length > 0 && (
                    <p className="text-[11px] text-slate-400 font-medium">
                      {chk.headingHierarchy.join(" > ")}
                    </p>
                  )}
                  <p className="text-xs text-slate-300 font-mono bg-slate-900/90 p-2 rounded border border-slate-800 line-clamp-4">
                    {chk.content}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Type: {chk.chunkType}</span>
                    <span>Vector: [{chk.embedding.slice(0, 3).map((n) => n.toFixed(3)).join(", ")}...] (768d)</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
