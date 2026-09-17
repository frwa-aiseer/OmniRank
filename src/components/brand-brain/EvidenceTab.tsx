import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  Quote,
  Sparkles,
  Filter,
  Layers,
  Award
} from "lucide-react";
import {
  EvidenceClaim,
  EvidenceSource,
  EvidenceVerificationStatus,
  EvidenceClaimType
} from "../../types/index.ts";

interface EvidenceTabProps {
  brandId: string;
  claims: EvidenceClaim[];
  sources: EvidenceSource[];
  isStrategistOrAdmin: boolean;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

export function EvidenceTab({
  brandId,
  claims,
  sources,
  isStrategistOrAdmin,
  onRefresh,
  onNotify
}: EvidenceTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [updatingClaimId, setUpdatingClaimId] = useState<string | null>(null);

  const handleUpdateStatus = async (claimId: string, newStatus: EvidenceVerificationStatus) => {
    if (!isStrategistOrAdmin) {
      onNotify("Permission denied: Only Strategists and Admins can verify claims.");
      return;
    }

    setUpdatingClaimId(claimId);
    try {
      const res = await fetch(`/api/brand-brain/${brandId}/evidence/${claimId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      onNotify(`Evidence claim marked as '${newStatus}'`);
      onRefresh();
    } catch (err: any) {
      onNotify(`Error: ${err.message}`);
    } finally {
      setUpdatingClaimId(null);
    }
  };

  const filteredClaims = claims.filter((claim) => {
    if (statusFilter !== "all" && claim.verificationStatus !== statusFilter) return false;
    if (typeFilter !== "all" && claim.claimType !== typeFilter) return false;
    return true;
  });

  const getStatusBadge = (status: EvidenceVerificationStatus) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified
          </span>
        );
      case "disputed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Disputed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case "unverified":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <HelpCircle className="w-3.5 h-3.5" />
            Unverified
          </span>
        );
    }
  };

  const getTypeBadge = (type: EvidenceClaimType) => {
    switch (type) {
      case "statistic":
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">Statistic</span>;
      case "benchmark":
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">Benchmark</span>;
      case "customer_result":
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Customer ROI</span>;
      case "compliance":
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Compliance</span>;
      case "pricing":
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">Pricing</span>;
      default:
        return <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Evidence Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            Evidence & Claims Engine
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Verifiable brand proof points, benchmarks, customer stats, and compliance badges. Claims are strictly cited and audited before generation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500 font-medium">Verified Claims</div>
            <div className="text-lg font-bold text-emerald-600">
              {claims.filter((c) => c.verificationStatus === "verified").length} / {claims.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Filter className="w-3.5 h-3.5" />
            Filter by:
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
            <option value="disputed">Disputed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Claim Types</option>
            <option value="statistic">Statistics & Numbers</option>
            <option value="benchmark">Technical Benchmarks</option>
            <option value="customer_result">Customer Results & ROI</option>
            <option value="compliance">Compliance & Certifications</option>
            <option value="pricing">Pricing Terms</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing {filteredClaims.length} of {claims.length} claims
        </div>
      </div>

      {/* Claims List */}
      <div className="space-y-4">
        {filteredClaims.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">No evidence claims match your filters</p>
            <p className="text-xs text-slate-500 mt-1">Ingest new whitepapers or documents in the Sources tab to extract claims.</p>
          </div>
        ) : (
          filteredClaims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-slate-300 transition-all space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getTypeBadge(claim.claimType)}
                    {getStatusBadge(claim.verificationStatus)}
                    <span className="text-[11px] font-mono text-slate-500">
                      Confidence: {(claim.confidenceScore * 100).toFixed(0)}%
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    "{claim.claimText}"
                  </h3>
                </div>

                {/* Verification Actions */}
                {isStrategistOrAdmin && (
                  <div className="flex items-center gap-1.5 self-start shrink-0">
                    <button
                      type="button"
                      disabled={updatingClaimId === claim.id || claim.verificationStatus === "verified"}
                      onClick={() => handleUpdateStatus(claim.id, "verified")}
                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verify
                    </button>
                    <button
                      type="button"
                      disabled={updatingClaimId === claim.id || claim.verificationStatus === "disputed"}
                      onClick={() => handleUpdateStatus(claim.id, "disputed")}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Dispute
                    </button>
                    <button
                      type="button"
                      disabled={updatingClaimId === claim.id || claim.verificationStatus === "rejected"}
                      onClick={() => handleUpdateStatus(claim.id, "rejected")}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Provenance & Citation Snippets */}
              {claim.sources.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Quote className="w-3 h-3 text-indigo-600" />
                    Provenance & Exact Citations
                  </div>
                  {claim.sources.map((src) => (
                    <div key={src.id} className="text-xs text-slate-700 space-y-1">
                      <p className="italic text-slate-800 font-mono bg-white p-2 rounded border border-slate-200">
                        "{src.exactQuote}"
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{src.sourceName}</span>
                        {src.pageOrSection && (
                          <span>Section: <span className="font-medium">{src.pageOrSection}</span></span>
                        )}
                        {src.sourceUrl && (
                          <a
                            href={src.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5"
                          >
                            Source Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Primary Evidence Sources Registry */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            Registered Evidence Sources ({sources.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-200">
          {sources.map((src) => (
            <div key={src.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{src.name}</span>
                  {src.isPrimarySource && (
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Primary Source
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publisher: {src.publisher || "Internal Brand Doc"} • Trust Score: {src.trustScore}/100
                </p>
              </div>

              {src.url && (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  Visit Source <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
