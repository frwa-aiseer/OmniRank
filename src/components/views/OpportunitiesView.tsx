import { useState } from "react";
import { Lightbulb, Plus, Target, ArrowUpRight, Trash2, Sparkles, Filter, X, AlertCircle } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { OpportunitySignal, OpportunityType } from "../../types/index.ts";

export function OpportunitiesView() {
  const { currentBrand, currentUser, opportunities, createOpportunity, deleteOpportunity, createArticle, setCurrentView } = useApp();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newConcept, setNewConcept] = useState("");
  const [newType, setNewType] = useState<OpportunityType>("new_content");
  const [newAudience, setNewAudience] = useState("");
  const [newIntent, setNewIntent] = useState<"high" | "medium" | "low">("high");
  const [newScore, setNewScore] = useState(85);
  const [formError, setFormError] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleAddOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Please enter an opportunity title.");
      return;
    }

    try {
      await createOpportunity({
        title: newTitle.trim(),
        targetConcept: newConcept.trim() || newTitle.trim(),
        type: newType,
        audienceMatch: newAudience.trim() || "Target Audience",
        commercialIntent: newIntent,
        priorityScore: Number(newScore) || 80,
      });

      setNewTitle("");
      setNewConcept("");
      setNewAudience("");
      setFormError("");
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create opportunity");
    }
  };

  const handleStartBrief = async (opp: OpportunitySignal) => {
    // Convert opportunity to article and jump to Content tab
    await createArticle({
      title: opp.title,
      targetKeyword: opp.targetConcept,
      summary: `Derived from opportunity signal: "${opp.title}". Target audience: ${opp.audienceMatch}. Commercial intent: ${opp.commercialIntent.toUpperCase()}.`,
      status: "drafting",
      version: "v1.0",
      canonicalBlocksCount: 6,
      evidenceClaimsCount: 1,
      authorName: currentUser.fullName || "Strategist",
    });

    // Remove or keep opportunity, navigate to content view
    setCurrentView("content");
  };

  const handleDelete = async (oppId: string) => {
    if (confirm("Remove this opportunity signal?")) {
      await deleteOpportunity(oppId);
    }
  };

  const handleRunDiscovery = () => {
    setIsDiscovering(true);
    setTimeout(() => {
      setIsDiscovering(false);
    }, 1200);
  };

  return (
    <div id="opportunities-view" className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
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
          <button
            onClick={handleRunDiscovery}
            disabled={isDiscovering}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isDiscovering ? "animate-spin text-indigo-600" : ""}`} />
            <span>{isDiscovering ? "Analyzing Brain..." : "Run Discovery"}</span>
          </button>
          <button
            onClick={() => {
              setFormError("");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Signal</span>
          </button>
        </div>
      </div>

      {/* Opportunities Table / Empty State */}
      {opportunities.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-neutral-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">No opportunities generated yet</h2>
            <p className="text-xs text-neutral-500">
              Add custom keyword signals or configure your Brand Brain to start prioritizing content topics for{" "}
              <span className="font-semibold text-neutral-700">{currentBrand?.name || "this brand"}</span>.
            </p>
          </div>
          <button
            onClick={() => {
              setFormError("");
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Keyword Signal</span>
          </button>
        </div>
      ) : (
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
            {opportunities.map((opp) => (
              <div key={opp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors">
                <div className="space-y-1">
                  <div className="font-semibold text-neutral-900 flex items-center gap-2">
                    <span>{opp.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                        opp.type === "new_content"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : opp.type === "content_refresh"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200"
                      }`}
                    >
                      {opp.type.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    Matches audience "{opp.audienceMatch}". Concept: {opp.targetConcept}. Intent: {opp.commercialIntent.toUpperCase()}.
                  </p>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-center">
                  <span className="text-xs text-neutral-600 capitalize">{opp.type.replace("_", " ")}</span>
                  <div className="text-right min-w-[50px]">
                    <span className="font-bold text-neutral-900">{opp.priorityScore}</span>
                    <span className="text-neutral-400 text-xs">/100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartBrief(opp)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      <span>Start Brief</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(opp.id)}
                      className="p-1 text-neutral-400 hover:text-rose-600 transition"
                      title="Delete Signal"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Opportunity Signal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-neutral-200 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">Add Content Opportunity Signal</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddOpportunity} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Topic / Working Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Modern PostgreSQL High-Availability Strategies"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target Concept / Keyword</label>
                <input
                  type="text"
                  value={newConcept}
                  onChange={(e) => setNewConcept(e.target.value)}
                  placeholder="e.g. postgresql high availability cluster"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Opportunity Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as OpportunityType)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="new_content">New Content</option>
                    <option value="content_refresh">Content Refresh</option>
                    <option value="cluster_expansion">Cluster Expansion</option>
                    <option value="decay_defense">Decay Defense</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Commercial Intent</label>
                  <select
                    value={newIntent}
                    onChange={(e) => setNewIntent(e.target.value as "high" | "medium" | "low")}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="high">High Intent</option>
                    <option value="medium">Medium Intent</option>
                    <option value="low">Low / Informational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Audience Match</label>
                  <input
                    type="text"
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value)}
                    placeholder="e.g. Lead Cloud Architect"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Priority Score (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newScore}
                    onChange={(e) => setNewScore(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition cursor-pointer"
                >
                  Add Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
