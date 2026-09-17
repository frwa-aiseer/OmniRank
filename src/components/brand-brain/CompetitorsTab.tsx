import { useState } from "react";
import { Plus, Swords, Globe, Archive, Edit2, ShieldAlert, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { BrandCompetitor } from "../../types";

interface CompetitorsTabProps {
  competitors: BrandCompetitor[];
  canEdit: boolean;
  onSaveCompetitor: (competitor: Partial<BrandCompetitor>) => Promise<void>;
  onToggleArchive: (competitorId: string) => Promise<void>;
}

export function CompetitorsTab({ competitors, canEdit, onSaveCompetitor, onToggleArchive }: CompetitorsTabProps) {
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [isEditing, setIsEditing] = useState(false);
  const [currentComp, setCurrentComp] = useState<Partial<BrandCompetitor> | null>(null);
  const [saving, setSaving] = useState(false);

  const [strengthInput, setStrengthInput] = useState("");
  const [weaknessInput, setWeaknessInput] = useState("");

  const filteredCompetitors = competitors.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const handleOpenCreate = () => {
    setCurrentComp({
      name: "",
      domain: "",
      positioning: "",
      keyStrengths: [],
      keyWeaknesses: [],
      differentiator: "",
      notes: "",
      status: "active"
    });
    setStrengthInput("");
    setWeaknessInput("");
    setIsEditing(true);
  };

  const handleOpenEdit = (c: BrandCompetitor) => {
    setCurrentComp({ ...c });
    setStrengthInput("");
    setWeaknessInput("");
    setIsEditing(true);
  };

  const addStrength = () => {
    if (!strengthInput.trim() || !currentComp) return;
    const list = currentComp.keyStrengths || [];
    setCurrentComp({ ...currentComp, keyStrengths: [...list, strengthInput.trim()] });
    setStrengthInput("");
  };

  const addWeakness = () => {
    if (!weaknessInput.trim() || !currentComp) return;
    const list = currentComp.keyWeaknesses || [];
    setCurrentComp({ ...currentComp, keyWeaknesses: [...list, weaknessInput.trim()] });
    setWeaknessInput("");
  };

  const removeStrength = (idx: number) => {
    if (!currentComp) return;
    setCurrentComp({
      ...currentComp,
      keyStrengths: (currentComp.keyStrengths || []).filter((_, i) => i !== idx)
    });
  };

  const removeWeakness = (idx: number) => {
    if (!currentComp) return;
    setCurrentComp({
      ...currentComp,
      keyWeaknesses: (currentComp.keyWeaknesses || []).filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentComp || !currentComp.name || !currentComp.domain) return;
    setSaving(true);
    try {
      await onSaveCompetitor(currentComp);
      setIsEditing(false);
      setCurrentComp(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Competitor Intelligence & Battle Cards</h2>
          <p className="text-xs text-neutral-500">
            Track market positioning, strengths, weaknesses, and unfair advantages for objective competitive comparisons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-neutral-100 p-1 rounded-lg text-xs font-medium text-neutral-600">
            <button
              onClick={() => setFilter("active")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "active" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Active ({competitors.filter((c) => c.status === "active").length})
            </button>
            <button
              onClick={() => setFilter("archived")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "archived" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Archived ({competitors.filter((c) => c.status === "archived").length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "all" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              All
            </button>
          </div>

          {canEdit && (
            <button
              id="btn-add-competitor"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Competitor</span>
            </button>
          )}
        </div>
      </div>

      {/* Competitor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredCompetitors.map((comp) => (
          <div
            key={comp.id}
            id={`competitor-card-${comp.id}`}
            className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 ${
              comp.status === "archived" ? "border-neutral-200 opacity-60 bg-neutral-50/50" : "border-neutral-200/80 hover:border-neutral-300"
            }`}
          >
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm leading-snug">{comp.name}</h3>
                    <a
                      href={`https://${comp.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-mono"
                    >
                      <Globe className="w-3 h-3 text-neutral-400" />
                      {comp.domain}
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {comp.status === "archived" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Archived
                    </span>
                  )}
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(comp)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900"
                        title="Edit Competitor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleArchive(comp.id)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900"
                        title={comp.status === "active" ? "Archive Competitor" : "Restore Competitor"}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                {comp.positioning || "No positioning summary registered."}
              </p>

              {/* Strengths & Weaknesses Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Strengths
                  </span>
                  <div className="bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100 space-y-1 text-neutral-700">
                    {comp.keyStrengths && comp.keyStrengths.length > 0 ? (
                      comp.keyStrengths.map((s, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-emerald-500">•</span>
                          <span>{s}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-neutral-400 italic">None listed</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-rose-700 uppercase flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Gaps / Weaknesses
                  </span>
                  <div className="bg-rose-50/40 p-2.5 rounded-lg border border-rose-100 space-y-1 text-neutral-700">
                    {comp.keyWeaknesses && comp.keyWeaknesses.length > 0 ? (
                      comp.keyWeaknesses.map((w, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-rose-500">•</span>
                          <span>{w}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-neutral-400 italic">None listed</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Our Differentiator */}
              {comp.differentiator && (
                <div className="pt-2 border-t border-neutral-100 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Our Core Advantage
                  </span>
                  <p className="text-xs text-neutral-800 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/80">
                    {comp.differentiator}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredCompetitors.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200 space-y-3">
          <Swords className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-sm font-medium text-neutral-600">No competitors registered</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isEditing && currentComp && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                {currentComp.id ? "Edit Competitor Profile" : "Add Tracked Competitor"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Competitor Name *</label>
                  <input
                    type="text"
                    required
                    value={currentComp.name || ""}
                    onChange={(e) => setCurrentComp({ ...currentComp, name: e.target.value })}
                    placeholder="e.g. SurferSEO"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Primary Domain *</label>
                  <input
                    type="text"
                    required
                    value={currentComp.domain || ""}
                    onChange={(e) => setCurrentComp({ ...currentComp, domain: e.target.value })}
                    placeholder="e.g. surferseo.com"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Market Positioning</label>
                <textarea
                  rows={2}
                  value={currentComp.positioning || ""}
                  onChange={(e) => setCurrentComp({ ...currentComp, positioning: e.target.value })}
                  placeholder="How do they position themselves in the market?"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              {/* Strengths builder */}
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Key Strengths</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={strengthInput}
                    onChange={(e) => setStrengthInput(e.target.value)}
                    placeholder="e.g. Strong brand awareness"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200"
                  />
                  <button type="button" onClick={addStrength} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-semibold">Add</button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(currentComp.keyStrengths || []).map((s, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 font-medium">
                      {s}
                      <button type="button" onClick={() => removeStrength(idx)} className="text-neutral-400 hover:text-rose-600 font-bold">×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Weaknesses builder */}
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Gaps & Weaknesses</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={weaknessInput}
                    onChange={(e) => setWeaknessInput(e.target.value)}
                    placeholder="e.g. Weak technical article support"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200"
                  />
                  <button type="button" onClick={addWeakness} className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-lg font-semibold">Add</button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(currentComp.keyWeaknesses || []).map((w, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 text-rose-800 font-medium">
                      {w}
                      <button type="button" onClick={() => removeWeakness(idx)} className="text-neutral-400 hover:text-rose-600 font-bold">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Our Differentiation Advantage</label>
                <textarea
                  rows={2}
                  value={currentComp.differentiator || ""}
                  onChange={(e) => setCurrentComp({ ...currentComp, differentiator: e.target.value })}
                  placeholder="Why our solution wins when compared head-to-head..."
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
                  {saving ? "Saving..." : "Save Competitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
