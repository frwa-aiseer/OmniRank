import { useState } from "react";
import { Plus, ShieldAlert, AlertTriangle, HelpCircle, Archive, Edit2, CheckCircle2, ShieldCheck, ShieldX, Filter } from "lucide-react";
import { BrandPolicy, PolicyCategory, PolicySeverity } from "../../types";

interface PoliciesTabProps {
  policies: BrandPolicy[];
  canEdit: boolean;
  onSavePolicy: (policy: Partial<BrandPolicy>) => Promise<void>;
  onToggleArchive: (policyId: string) => Promise<void>;
}

export function PoliciesTab({ policies, canEdit, onSavePolicy, onToggleArchive }: PoliciesTabProps) {
  const [filterSeverity, setFilterSeverity] = useState<PolicySeverity | "all">("all");
  const [filterCategory, setFilterCategory] = useState<PolicyCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"active" | "archived" | "all">("active");

  const [isEditing, setIsEditing] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<Partial<BrandPolicy> | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredPolicies = policies.filter((p) => {
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    if (filterSeverity !== "all" && p.severity !== filterSeverity) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    return true;
  });

  const handleOpenCreate = () => {
    setCurrentPolicy({
      title: "",
      description: "",
      category: "factual_claim",
      severity: "blocking",
      enforcementAction: "",
      status: "active"
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (p: BrandPolicy) => {
    setCurrentPolicy({ ...p });
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPolicy || !currentPolicy.title) return;
    setSaving(true);
    try {
      await onSavePolicy(currentPolicy);
      setIsEditing(false);
      setCurrentPolicy(null);
    } finally {
      setSaving(false);
    }
  };

  const getSeverityBadge = (severity: PolicySeverity) => {
    switch (severity) {
      case "blocking":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldX className="w-3.5 h-3.5 text-rose-600" />
            Blocking Gate
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Warning Flag
          </span>
        );
      case "suggestion":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
            Suggestion
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Brand Safety & Editorial Policies</h2>
          <p className="text-xs text-neutral-500">
            Define compliance rules, citation requirements, and legal guardrails enforced across all block edits.
          </p>
        </div>

        {canEdit && (
          <button
            id="btn-add-policy"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Define Policy</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-neutral-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Severity:
          </span>
          <button
            onClick={() => setFilterSeverity("all")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filterSeverity === "all" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterSeverity("blocking")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filterSeverity === "blocking" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Blocking
          </button>
          <button
            onClick={() => setFilterSeverity("warning")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filterSeverity === "warning" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Warning
          </button>
          <button
            onClick={() => setFilterSeverity("suggestion")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filterSeverity === "suggestion" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            Suggestion
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as PolicyCategory | "all")}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-700 font-medium"
          >
            <option value="all">All Categories</option>
            <option value="factual_claim">Factual Claims</option>
            <option value="competitor_reference">Competitor References</option>
            <option value="compliance_legal">Compliance & Legal</option>
            <option value="editorial_style">Editorial Style</option>
            <option value="pricing_mention">Pricing Mentions</option>
          </select>

          <button
            onClick={() => setFilterStatus(filterStatus === "active" ? "archived" : "active")}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 font-medium"
          >
            {filterStatus === "active" ? "Show Archived" : "Show Active"}
          </button>
        </div>
      </div>

      {/* Policy List */}
      <div className="space-y-3">
        {filteredPolicies.map((policy) => (
          <div
            key={policy.id}
            id={`policy-card-${policy.id}`}
            className={`bg-white rounded-xl border p-5 shadow-xs transition-all space-y-3 ${
              policy.status === "archived"
                ? "border-neutral-200 opacity-60 bg-neutral-50/50"
                : policy.severity === "blocking"
                ? "border-rose-200/80 hover:border-rose-300"
                : policy.severity === "warning"
                ? "border-amber-200/80 hover:border-amber-300"
                : "border-neutral-200/80 hover:border-neutral-300"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getSeverityBadge(policy.severity)}
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-neutral-100 text-neutral-600">
                    {policy.category.replace("_", " ")}
                  </span>
                  {policy.status === "archived" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-200 text-neutral-600">
                      Archived
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-neutral-900 pt-1">{policy.title}</h3>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(policy)}
                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900"
                    title="Edit Policy"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onToggleArchive(policy.id)}
                    className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900"
                    title={policy.status === "active" ? "Archive Policy" : "Restore Policy"}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-neutral-700 leading-relaxed bg-neutral-50/70 p-3 rounded-lg border border-neutral-100">
              {policy.description}
            </p>

            {policy.enforcementAction && (
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 pt-1">
                <span className="font-semibold text-neutral-700 uppercase tracking-wider text-[10px]">Enforcement:</span>
                <span>{policy.enforcementAction}</span>
              </div>
            )}
          </div>
        ))}

        {filteredPolicies.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-neutral-200 space-y-3">
            <ShieldAlert className="w-8 h-8 text-neutral-300 mx-auto" />
            <p className="text-sm font-medium text-neutral-600">No policies found matching filters</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && currentPolicy && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                {currentPolicy.id ? "Edit Brand Policy" : "Define New Brand Policy"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Policy Title *</label>
                <input
                  type="text"
                  required
                  value={currentPolicy.title || ""}
                  onChange={(e) => setCurrentPolicy({ ...currentPolicy, title: e.target.value })}
                  placeholder="e.g. Mandatory Source Citation for Benchmarks"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Severity Gate</label>
                  <select
                    value={currentPolicy.severity}
                    onChange={(e) => setCurrentPolicy({ ...currentPolicy, severity: e.target.value as PolicySeverity })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  >
                    <option value="blocking">Blocking (Hard gate on publishing)</option>
                    <option value="warning">Warning (Requires editor verification)</option>
                    <option value="suggestion">Suggestion (Recommended guideline)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Category</label>
                  <select
                    value={currentPolicy.category}
                    onChange={(e) => setCurrentPolicy({ ...currentPolicy, category: e.target.value as PolicyCategory })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  >
                    <option value="factual_claim">Factual Claims</option>
                    <option value="competitor_reference">Competitor References</option>
                    <option value="compliance_legal">Compliance & Legal</option>
                    <option value="editorial_style">Editorial Style</option>
                    <option value="pricing_mention">Pricing Mentions</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Rule Description & Requirements *</label>
                <textarea
                  rows={3}
                  required
                  value={currentPolicy.description || ""}
                  onChange={(e) => setCurrentPolicy({ ...currentPolicy, description: e.target.value })}
                  placeholder="Specify exactly what constitutes compliance or a violation..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Enforcement Action</label>
                <input
                  type="text"
                  value={currentPolicy.enforcementAction || ""}
                  onChange={(e) => setCurrentPolicy({ ...currentPolicy, enforcementAction: e.target.value })}
                  placeholder="e.g. Rejects block approval until primary link is attached"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {saving ? "Saving..." : "Save Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
