import { Brain, Database, Users, ShieldAlert, Sparkles, Building2 } from "lucide-react";

export function BrandBrainView() {
  return (
    <div id="brand-brain-view" className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          <Brain className="w-4 h-4" />
          <span>Brand Intelligence</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What does OmniRank know about us?</h1>
        <p className="text-sm text-neutral-500">
          The centralized knowledge base of brand voice, products, audiences, policies, evidence sources, and competitors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
          <h2 className="font-semibold text-neutral-900 text-sm">Products & Services</h2>
          <p className="text-xs text-neutral-500">
            3 active offerings registered with value propositions, technical features, and pricing tiers.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="font-semibold text-neutral-900 text-sm">Target Audiences</h2>
          <p className="text-xs text-neutral-500">
            Defined ICP personas: VP Engineering, Cloud Architects, and DevOps Leads.
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h2 className="font-semibold text-neutral-900 text-sm">Brand Policies</h2>
          <p className="text-xs text-neutral-500">
            Rules enforcing terminology, claim citations, competitor positioning, and regulatory gates.
          </p>
        </div>
      </div>
    </div>
  );
}
