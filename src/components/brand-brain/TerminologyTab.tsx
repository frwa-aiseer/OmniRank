import { useState } from "react";
import { Plus, BookOpen, CheckCircle, XCircle, Archive, ArrowRight, ShieldCheck } from "lucide-react";
import { BrandTerminology } from "../../types";

interface TerminologyTabProps {
  terminology: BrandTerminology[];
  canEdit: boolean;
  onSaveTerminology: (data: Omit<BrandTerminology, "id" | "brandId" | "createdAt">) => Promise<void>;
  onToggleArchive: (termId: string) => Promise<void>;
}

export function TerminologyTab({ terminology, canEdit, onSaveTerminology, onToggleArchive }: TerminologyTabProps) {
  const [filter, setFilter] = useState<"all" | "preferred" | "avoided">("all");
  const [isAdding, setIsAdding] = useState(false);
  const [termForm, setTermForm] = useState<Omit<BrandTerminology, "id" | "brandId" | "createdAt">>({
    type: "preferred",
    term: "",
    replacement: "",
    reason: "",
    caseSensitive: false,
    status: "active"
  });
  const [saving, setSaving] = useState(false);

  const activeTerms = terminology.filter((t) => t.status === "active");
  const filteredTerms = activeTerms.filter((t) => {
    if (filter === "all") return true;
    return t.type === filter;
  });

  const preferredTerms = activeTerms.filter((t) => t.type === "preferred");
  const avoidedTerms = activeTerms.filter((t) => t.type === "avoided");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termForm.term.trim()) return;
    setSaving(true);
    try {
      await onSaveTerminology(termForm);
      setIsAdding(false);
      setTermForm({
        type: "preferred",
        term: "",
        replacement: "",
        reason: "",
        caseSensitive: false,
        status: "active"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Brand Terminology & Glossary</h2>
          <p className="text-xs text-neutral-500">
            Enforce preferred phrasing and automatically flag prohibited marketing clichés across articles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-100 p-1 rounded-lg text-xs font-medium text-neutral-600">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "all" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              All ({activeTerms.length})
            </button>
            <button
              onClick={() => setFilter("preferred")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "preferred" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Preferred ({preferredTerms.length})
            </button>
            <button
              onClick={() => setFilter("avoided")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "avoided" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Avoided ({avoidedTerms.length})
            </button>
          </div>

          {canEdit && (
            <button
              id="btn-add-term"
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Term</span>
            </button>
          )}
        </div>
      </div>

      {/* Two Column Layout for Preferred vs Avoided */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preferred Terms */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Preferred Terms & Standards ({preferredTerms.length})</span>
          </div>

          <div className="space-y-3">
            {preferredTerms.map((term) => (
              <div key={term.id} className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900 text-sm font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-100">
                      {term.term}
                    </span>
                    {term.caseSensitive && (
                      <span className="text-[10px] uppercase font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                        Case Sensitive
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => onToggleArchive(term.id)}
                      className="text-neutral-400 hover:text-neutral-700 p-1"
                      title="Archive Term"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-neutral-600">
                  <span className="font-semibold text-neutral-700">Rationale: </span>
                  {term.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Avoided Terms */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Avoided Terms & Banned Clichés ({avoidedTerms.length})</span>
          </div>

          <div className="space-y-3">
            {avoidedTerms.map((term) => (
              <div key={term.id} className="bg-white rounded-xl border border-neutral-200/80 p-4 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-rose-700 text-sm font-mono line-through bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      {term.term}
                    </span>
                    {term.replacement && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        <ArrowRight className="w-3 h-3" /> {term.replacement}
                      </span>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => onToggleArchive(term.id)}
                      className="text-neutral-400 hover:text-neutral-700 p-1"
                      title="Archive Term"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-neutral-600">
                  <span className="font-semibold text-neutral-700">Why to avoid: </span>
                  {term.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Term Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">Add Terminology Rule</h3>
              <button onClick={() => setIsAdding(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Term Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTermForm({ ...termForm, type: "preferred" })}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      termForm.type === "preferred"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    ✓ Preferred Term
                  </button>
                  <button
                    type="button"
                    onClick={() => setTermForm({ ...termForm, type: "avoided" })}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      termForm.type === "avoided"
                        ? "bg-rose-50 border-rose-300 text-rose-700 shadow-2xs"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    ✕ Avoided / Banned
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target Term *</label>
                <input
                  type="text"
                  required
                  value={termForm.term}
                  onChange={(e) => setTermForm({ ...termForm, term: e.target.value })}
                  placeholder={termForm.type === "preferred" ? "e.g. Brand Brain" : "e.g. supercharge"}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              {termForm.type === "avoided" && (
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Preferred Replacement</label>
                  <input
                    type="text"
                    value={termForm.replacement || ""}
                    onChange={(e) => setTermForm({ ...termForm, replacement: e.target.value })}
                    placeholder="e.g. accelerate / optimize"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Reason / Usage Guidelines *</label>
                <textarea
                  rows={2}
                  required
                  value={termForm.reason}
                  onChange={(e) => setTermForm({ ...termForm, reason: e.target.value })}
                  placeholder="Why this term is preferred or forbidden..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={termForm.caseSensitive}
                  onChange={(e) => setTermForm({ ...termForm, caseSensitive: e.target.checked })}
                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-neutral-700 font-medium">Exact case sensitive match</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {saving ? "Saving..." : "Save Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
