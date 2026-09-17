import {
  Brain,
  Building2,
  Users,
  Mic,
  BookOpen,
  ShieldAlert,
  Swords,
  History,
  CheckCircle2,
  AlertTriangle,
  Flame,
  HelpCircle,
  ExternalLink,
  Plus,
  UploadCloud,
  Award
} from "lucide-react";
import { BrandBrainKnowledge } from "../../types";

interface OverviewTabProps {
  knowledge: BrandBrainKnowledge;
  onNavigateTab: (tab: string) => void;
  canEdit: boolean;
}

export function OverviewTab({ knowledge, onNavigateTab, canEdit }: OverviewTabProps) {
  const { profile, products, audiences, voiceProfile, terminology, policies, competitors, recentAuditLogs, completenessScore } = knowledge;

  const activeProducts = products.filter((p) => p.status === "active");
  const activeAudiences = audiences.filter((a) => a.status === "active");
  const activePolicies = policies.filter((p) => p.status === "active");
  const blockingPolicies = activePolicies.filter((p) => p.severity === "blocking");
  const warningPolicies = activePolicies.filter((p) => p.severity === "warning");
  const suggestionPolicies = activePolicies.filter((p) => p.severity === "suggestion");
  const activeCompetitors = competitors.filter((c) => c.status === "active");

  return (
    <div className="space-y-6">
      {/* Top Banner: Completeness & Positioning */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Brand Brain Knowledge
              </span>
              <span className="text-xs text-neutral-400 font-mono">ID: {profile.brandId}</span>
            </div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
              {profile.positioningStatement || "Unified Brand Intelligence"}
            </h2>
            <p className="text-sm text-neutral-600 max-w-3xl">
              {profile.mission || "Configure your brand identity, product offerings, audience personas, and editorial policies below."}
            </p>
          </div>

          {/* Completeness Meter */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-100 min-w-[220px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-600">Knowledge Readiness</span>
              <span className="text-sm font-bold text-indigo-600">{completenessScore}%</span>
            </div>
            <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${completenessScore}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{completenessScore >= 80 ? "Comprehensive & Content-Ready" : "Add more products & voice rules"}</span>
            </p>
          </div>
        </div>

        {/* Tone Traits & Value Prop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-100">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Core Value Proposition</span>
            <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-100">
              {profile.valueProposition || "Define what makes your technical solution uniquely valuable."}
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Target Market & Keywords</span>
            <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 space-y-2">
              <p className="text-xs text-neutral-700">{profile.targetMarket || "Enterprise SaaS & Cloud Infrastructure"}</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.toneKeywords.map((kw, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded text-[11px] font-medium bg-white text-neutral-700 border border-neutral-200 shadow-2xs">
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Brand Brain Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Products */}
        <div
          id="card-products-overview"
          onClick={() => onNavigateTab("products")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {activeProducts.length} Active <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Products & Services</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Offerings, feature matrices, value props, and target audience linkages.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
            {activeProducts.slice(0, 2).map((p) => (
              <span key={p.id} className="text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Audiences */}
        <div
          id="card-audiences-overview"
          onClick={() => onNavigateTab("audiences")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {activeAudiences.length} Personas <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Target Audiences</h3>
            <p className="text-xs text-neutral-500 mt-1">
              ICPs, pain points, technical objections, and decision-maker motivations.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
            {activeAudiences.slice(0, 2).map((a) => (
              <span key={a.id} className="text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                {a.name}
              </span>
            ))}
          </div>
        </div>

        {/* Voice Profile */}
        <div
          id="card-voice-overview"
          onClick={() => onNavigateTab("voice")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {knowledge.voiceExamples.length} Examples <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Voice & Archetype</h3>
            <p className="text-xs text-neutral-500 mt-1">
              {voiceProfile.archetype} ({voiceProfile.readingGradeLevel})
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
            {voiceProfile.primaryToneTraits.slice(0, 3).map((t, idx) => (
              <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-indigo-50/60 text-indigo-700 font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Terminology */}
        <div
          id="card-terminology-overview"
          onClick={() => onNavigateTab("terminology")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {terminology.length} Terms <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Terminology & Jargon</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Mandated preferred phrasing vs banned marketing clichés and competitors.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span className="text-emerald-600 font-medium">{terminology.filter((t) => t.type === "preferred").length} Preferred</span>
            <span className="text-rose-600 font-medium">{terminology.filter((t) => t.type === "avoided").length} Avoided</span>
          </div>
        </div>

        {/* Policies */}
        <div
          id="card-policies-overview"
          onClick={() => onNavigateTab("policies")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {activePolicies.length} Active Rules <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Brand Policies</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Mandatory evidence citations, compliance gates, and editorial rules.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
              {blockingPolicies.length} Blocking
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              {warningPolicies.length} Warning
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              {suggestionPolicies.length} Suggestion
            </span>
          </div>
        </div>

        {/* Competitors */}
        <div
          id="card-competitors-overview"
          onClick={() => onNavigateTab("competitors")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Swords className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {activeCompetitors.length} Tracked <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Competitor Intelligence</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Battle cards, positioning comparisons, and verified differentiators.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex flex-wrap gap-1">
            {activeCompetitors.map((c) => (
              <span key={c.id} className="text-[11px] px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* Knowledge Sources & Documents */}
        <div
          id="card-sources-overview"
          onClick={() => onNavigateTab("sources")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {knowledge.documents?.length || 0} Docs <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Knowledge Documents</h3>
            <p className="text-xs text-neutral-500 mt-1">
              PDFs, whitepapers, spreadsheets, and web crawls ingested into vector store.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span className="text-indigo-600 font-medium">
              {knowledge.documents?.reduce((acc, d) => acc + d.chunkCount, 0) || 0} Semantic Chunks
            </span>
            <span className="text-emerald-600 font-medium">pgvector Ready</span>
          </div>
        </div>

        {/* Evidence Claims */}
        <div
          id="card-evidence-overview"
          onClick={() => onNavigateTab("evidence")}
          className="group cursor-pointer bg-white p-5 rounded-xl border border-neutral-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 group-hover:text-indigo-600 flex items-center gap-1">
              {knowledge.evidenceClaims?.length || 0} Claims <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 text-sm">Evidence & Citations</h3>
            <p className="text-xs text-neutral-500 mt-1">
              Verified statistics, latency benchmarks, and customer ROI metrics.
            </p>
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
            <span className="text-emerald-600 font-medium">
              {knowledge.evidenceClaims?.filter((c) => c.verificationStatus === "verified").length || 0} Verified
            </span>
            <span className="text-amber-600 font-medium">
              {knowledge.evidenceClaims?.filter((c) => c.verificationStatus === "unverified").length || 0} Unverified
            </span>
          </div>
        </div>
      </div>

      {/* Recent Audit Trail Preview */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-bold text-neutral-900">Recent Knowledge Modifications</h3>
          </div>
          <button
            onClick={() => onNavigateTab("audit-log")}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View Full Audit History →
          </button>
        </div>

        <div className="divide-y divide-neutral-100 text-xs">
          {recentAuditLogs.slice(0, 4).map((log) => (
            <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase ${
                  log.action === "create"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : log.action === "update"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  {log.action}
                </span>
                <span className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">{log.entityType}</span>
                <span className="text-neutral-600">{log.summary}</span>
              </div>
              <div className="text-right text-neutral-400 shrink-0">
                <span className="font-medium text-neutral-600 mr-2">{log.userName}</span>
                <span>{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
