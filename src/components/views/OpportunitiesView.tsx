import { Lightbulb, Filter, Plus, Target, ArrowUpRight } from "lucide-react";

export function OpportunitiesView() {
  return (
    <div id="opportunities-view" className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <Lightbulb className="w-4 h-4" />
            <span>Discovery Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What should we work on next?</h1>
          <p className="text-sm text-neutral-500">
            Prioritized content opportunities derived from keyword signals, brand offerings, and competitive gaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter</span>
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Signal</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs font-medium text-neutral-600">
          <span>Opportunity & Target Concept</span>
          <div className="flex items-center gap-8">
            <span>Type</span>
            <span>Priority Score</span>
            <span>Action</span>
          </div>
        </div>

        <div className="divide-y divide-neutral-200 text-sm">
          <div className="p-4 flex items-center justify-between hover:bg-neutral-50/70 transition-colors">
            <div className="space-y-1">
              <div className="font-semibold text-neutral-900 flex items-center gap-2">
                <span>Multi-Cloud FinOps Best Practices for High-Growth SaaS</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                  New Content
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Matches primary audience "VP of Engineering" and 2 core products. High commercial intent.
              </p>
            </div>
            <div className="flex items-center gap-8">
              <span className="text-xs text-neutral-600">Cluster Expansion</span>
              <div className="text-right">
                <span className="font-bold text-neutral-900">94</span>
                <span className="text-neutral-400 text-xs">/100</span>
              </div>
              <button className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors cursor-pointer">
                <span>Start Brief</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 flex items-center justify-between hover:bg-neutral-50/70 transition-colors">
            <div className="space-y-1">
              <div className="font-semibold text-neutral-900 flex items-center gap-2">
                <span>SOC2 Type II Audit Preparation Checklist</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
                  Content Refresh
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Rank drop from #3 to #6. 4 competitor pages updated citations recently.
              </p>
            </div>
            <div className="flex items-center gap-8">
              <span className="text-xs text-neutral-600">Decay Defense</span>
              <div className="text-right">
                <span className="font-bold text-neutral-900">88</span>
                <span className="text-neutral-400 text-xs">/100</span>
              </div>
              <button className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors cursor-pointer">
                <span>Refresh Draft</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
