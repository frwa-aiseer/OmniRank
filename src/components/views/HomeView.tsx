import { Compass, Sparkles, ArrowRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function HomeView() {
  const { setCurrentView } = useApp();

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
          OmniRank continuously analyzes your Brand Brain, search signals, and content performance to prioritize next best actions.
        </p>
      </div>

      {/* Primary Recommended Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              High Impact
            </span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 text-base">Create High-Intent Guide</h2>
            <p className="text-xs text-neutral-500 mt-1">
              "Kubernetes Cost Optimization in 2026" matches 3 core products and has high audience search demand.
            </p>
          </div>
          <button
            onClick={() => setCurrentView("opportunities")}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <span>Review Opportunity</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Content Refresh
            </span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 text-base">Refresh Decaying Article</h2>
            <p className="text-xs text-neutral-500 mt-1">
              "SOC2 Compliance Guide" has dropped 3 positions in search rankings over the past 30 days.
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

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4 hover:border-neutral-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              Knowledge Update
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-neutral-900 text-base">Ingest Product Release Notes</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Update Brand Brain with recent feature releases to enable accurate evidence citations.
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

      {/* Activity Timeline / Today's Summary */}
      <div className="p-6 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neutral-500" />
          <span>Operational Pipeline State</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">12</div>
            <div className="text-xs text-neutral-500 mt-0.5">Active Opportunities</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">4</div>
            <div className="text-xs text-neutral-500 mt-0.5">In Drafting</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-neutral-900">2</div>
            <div className="text-xs text-neutral-500 mt-0.5">Awaiting Approval</div>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-100">
            <div className="text-2xl font-bold text-emerald-600">98.4%</div>
            <div className="text-xs text-neutral-500 mt-0.5">Brand Policy Health</div>
          </div>
        </div>
      </div>
    </div>
  );
}
