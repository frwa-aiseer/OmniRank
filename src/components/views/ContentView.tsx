import { FileText, Plus, CheckCircle, Clock, Eye } from "lucide-react";

export function ContentView() {
  return (
    <div id="content-view" className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <FileText className="w-4 h-4" />
            <span>Structured Articles</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What are we creating?</h1>
          <p className="text-sm text-neutral-500">
            Versioned, canonical block-based articles backed by evidence claims and brand voice policies.
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          <span>New Article Document</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              In Drafting (v1.2)
            </span>
            <span className="text-xs text-neutral-400">14 Canonical Blocks</span>
          </div>
          <h2 className="font-semibold text-neutral-900 text-base">
            Continuous Security Verification in Modern Cloud Infrastructure
          </h2>
          <p className="text-xs text-neutral-500">
            Structured outline approved. 6 evidence claims cited from official whitepapers.
          </p>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Last edited 22m ago by Alex Rivera</span>
            <button className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer">
              <span>Open Block Editor</span>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Awaiting Review (v2.0)
            </span>
            <span className="text-xs text-neutral-400">22 Canonical Blocks</span>
          </div>
          <h2 className="font-semibold text-neutral-900 text-base">
            The Definitive Architecture of AI Routing Engines
          </h2>
          <p className="text-xs text-neutral-500">
            Immutable milestone version ready for separation-of-duties review and WordPress publishing.
          </p>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-500">SEO & Policy Gate Passed (100%)</span>
            <button className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer">
              <span>Review Version</span>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
