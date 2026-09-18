import { Compass, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Clock, Plus, BookOpen, Globe, FileText, Lightbulb } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function HomeView() {
  const {
    currentOrg,
    currentBrand,
    currentWebsite,
    articles,
    opportunities,
    setCurrentView,
  } = useApp();

  const hasOrg = Boolean(currentOrg?.id && currentOrg.id !== "00000000-0000-0000-0000-000000000000");
  const hasBrand = Boolean(currentBrand?.id && currentBrand.id !== "00000000-0000-0000-0000-000000000000");

  const draftingCount = articles.filter((a) => a.status === "drafting").length;
  const reviewCount = articles.filter((a) => a.status === "review").length;
  const approvedCount = articles.filter((a) => a.status === "approved" || a.status === "published").length;
  const oppCount = opportunities.length;

  // Derive dynamic top action items
  const topOpportunity = opportunities[0];
  const pendingReviewArticle = articles.find((a) => a.status === "review");
  const activeDraftArticle = articles.find((a) => a.status === "drafting");

  return (
    <div id="home-view" className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          <Compass className="w-4 h-4" />
          <span>Action Hub</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What should I do today?</h1>
        <p className="text-sm text-neutral-500">
          {hasBrand
            ? `Active brand workspace: ${currentBrand.name}. Real-time recommendations based on your Brand Brain, discovered opportunities, and content workflow.`
            : "OmniRank continuously analyzes your Brand Brain, search signals, and content performance to prioritize next best actions."}
        </p>
      </div>

      {/* Operational Pipeline State */}
      <div className="p-6 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500" />
          <span>Operational Pipeline State</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">{oppCount}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Active Opportunities</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">{draftingCount}</div>
            <div className="text-xs text-neutral-500 mt-0.5">In Drafting</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">{reviewCount}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Awaiting Approval</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">{approvedCount}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Approved & Published</div>
          </div>
        </div>
      </div>

      {/* If No Organization or Brand is Configured */}
      {!hasOrg || !hasBrand ? (
        <div className="p-6 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Getting Started with OmniRank</span>
          </div>
          <p className="text-xs text-neutral-600">
            Create your first organization and brand to activate the full AI Content Growth Operating System.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <span className="text-xs font-semibold text-neutral-700 block">1. Setup Hierarchy</span>
              <p className="text-xs text-neutral-500">
                Create an Organization and Brand in Settings to establish tenant boundaries.
              </p>
              <button
                onClick={() => setCurrentView("settings")}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
              >
                <span>Go to Settings</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <span className="text-xs font-semibold text-neutral-700 block">2. Ingest Brand Brain</span>
              <p className="text-xs text-neutral-500">
                Add products, audience personas, voice rules, and upload authoritative documents.
              </p>
              <button
                onClick={() => setCurrentView("brand-brain")}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition cursor-pointer"
              >
                <span>Brand Brain</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <span className="text-xs font-semibold text-neutral-700 block">3. Discover & Create</span>
              <p className="text-xs text-neutral-500">
                Identify high-intent content opportunities and produce versioned, block-based articles.
              </p>
              <button
                onClick={() => setCurrentView("opportunities")}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 transition cursor-pointer"
              >
                <span>Opportunities</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Dynamic Action Cards for Configured Brand */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Opportunities / Discovery */}
          <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Discovery
              </span>
              <Lightbulb className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 text-base">
                {topOpportunity ? topOpportunity.title : "Discover Content Opportunities"}
              </h2>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {topOpportunity
                  ? `Priority score: ${topOpportunity.priorityScore}/100. Target concept: ${topOpportunity.targetConcept}`
                  : "Analyze keyword signals and competitor gaps to prioritize your next high-impact content pieces."}
              </p>
            </div>
            <button
              onClick={() => setCurrentView("opportunities")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <span>{topOpportunity ? "Review Opportunity" : "Explore Opportunities"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 2: Article Workspace */}
          <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Content Engine
              </span>
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 text-base">
                {pendingReviewArticle
                  ? `Review: ${pendingReviewArticle.title}`
                  : activeDraftArticle
                  ? `Continue Drafting: ${activeDraftArticle.title}`
                  : "Structured Articles"}
              </h2>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {pendingReviewArticle
                  ? `Version ${pendingReviewArticle.version} is awaiting editorial policy review before publishing.`
                  : activeDraftArticle
                  ? `Active draft with ${activeDraftArticle.canonicalBlocksCount} canonical blocks.`
                  : "Create and manage versioned, canonical block-based articles backed by evidence claims and brand policies."}
              </p>
            </div>
            <button
              onClick={() => setCurrentView("content")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white border border-neutral-300 text-neutral-800 text-xs font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <span>Open Article Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card 3: Brand Brain Ingestion */}
          <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Knowledge
              </span>
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-neutral-900 text-base">Brand Brain Intelligence</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {currentWebsite?.domain
                  ? `Connected domain: ${currentWebsite.domain}. Maintain brand voice, products, and evidence claims.`
                  : "Configure products, target personas, terminology rules, and policies for this brand."}
              </p>
            </div>
            <button
              onClick={() => setCurrentView("brand-brain")}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-white border border-neutral-300 text-neutral-800 text-xs font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <span>Go to Brand Brain</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
