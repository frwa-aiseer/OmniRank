import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Globe, CheckCircle2 } from "lucide-react";

export function CalendarView() {
  return (
    <div id="calendar-view" className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <CalendarIcon className="w-4 h-4" />
            <span>Editorial Schedule</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">When is it going live?</h1>
          <p className="text-sm text-neutral-500">
            Publishing calendar mapped to target CMS destinations and distribution workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-neutral-800 px-3">September 2026</span>
          <button className="p-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Upcoming Scheduled Releases</h2>
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex flex-col items-center justify-center font-bold text-xs leading-none">
                <span>SEP</span>
                <span className="text-sm">18</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-neutral-900">
                  Multi-Cloud FinOps Best Practices for High-Growth SaaS
                </h3>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-neutral-400" />
                  <span>WordPress (apexcloud.example.com/blog)</span>
                  <span>•</span>
                  <span>Auto-publish at 09:00 UTC</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved Version Locked
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
