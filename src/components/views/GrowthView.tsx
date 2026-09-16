import { TrendingUp, ArrowUpRight, Search, BarChart3, Activity } from "lucide-react";

export function GrowthView() {
  return (
    <div id="growth-view" className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          <TrendingUp className="w-4 h-4" />
          <span>Growth Brain</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What is working?</h1>
        <p className="text-sm text-neutral-500">
          Search performance, query impressions, click-through rates, and synchronized Google Search Console / GA4 metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Total Impressions (30d)</span>
            <Search className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">482,900</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+18.4% vs previous 30d</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Organic Clicks (30d)</span>
            <BarChart3 className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">32,450</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+24.1% vs previous 30d</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Average CTR</span>
            <Activity className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">6.72%</div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+0.8% CTR uplift</span>
          </div>
        </div>
      </div>
    </div>
  );
}
