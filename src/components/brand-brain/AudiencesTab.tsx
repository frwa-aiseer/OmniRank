import { useState } from "react";
import { Plus, Users, Archive, Edit2, CheckCircle2, XCircle, Target, Sparkles, Radio } from "lucide-react";
import { BrandAudience } from "../../types";

interface AudiencesTabProps {
  audiences: BrandAudience[];
  canEdit: boolean;
  onSaveAudience: (audience: Partial<BrandAudience>) => Promise<void>;
  onToggleArchive: (audienceId: string) => Promise<void>;
}

export function AudiencesTab({ audiences, canEdit, onSaveAudience, onToggleArchive }: AudiencesTabProps) {
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");
  const [isEditing, setIsEditing] = useState(false);
  const [currentAudience, setCurrentAudience] = useState<Partial<BrandAudience> | null>(null);
  const [saving, setSaving] = useState(false);

  // String buffer inputs for list fields
  const [painInput, setPainInput] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [objectionInput, setObjectionInput] = useState("");
  const [channelInput, setChannelInput] = useState("");

  const filteredAudiences = audiences.filter((a) => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  const handleOpenCreate = () => {
    setCurrentAudience({
      name: "",
      jobTitle: "",
      painPoints: [],
      goals: [],
      objections: [],
      preferredChannels: [],
      status: "active"
    });
    setPainInput("");
    setGoalInput("");
    setObjectionInput("");
    setChannelInput("");
    setIsEditing(true);
  };

  const handleOpenEdit = (a: BrandAudience) => {
    setCurrentAudience({ ...a });
    setPainInput("");
    setGoalInput("");
    setObjectionInput("");
    setChannelInput("");
    setIsEditing(true);
  };

  const addItem = (field: "painPoints" | "goals" | "objections" | "preferredChannels", value: string, setter: (val: string) => void) => {
    if (!value.trim() || !currentAudience) return;
    const currentList = currentAudience[field] || [];
    setCurrentAudience({
      ...currentAudience,
      [field]: [...currentList, value.trim()]
    });
    setter("");
  };

  const removeItem = (field: "painPoints" | "goals" | "objections" | "preferredChannels", idx: number) => {
    if (!currentAudience) return;
    const currentList = currentAudience[field] || [];
    setCurrentAudience({
      ...currentAudience,
      [field]: currentList.filter((_, i) => i !== idx)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAudience || !currentAudience.name) return;
    setSaving(true);
    try {
      await onSaveAudience(currentAudience);
      setIsEditing(false);
      setCurrentAudience(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Target Audiences & Personas</h2>
          <p className="text-xs text-neutral-500">
            Define Ideal Customer Profiles (ICPs), their technical pain points, core goals, and purchase objections.
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
              Active ({audiences.filter((a) => a.status === "active").length})
            </button>
            <button
              onClick={() => setFilter("archived")}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === "archived" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "hover:text-neutral-900"
              }`}
            >
              Archived ({audiences.filter((a) => a.status === "archived").length})
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
              id="btn-add-audience"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Persona</span>
            </button>
          )}
        </div>
      </div>

      {/* Audience Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredAudiences.map((audience) => (
          <div
            key={audience.id}
            id={`audience-card-${audience.id}`}
            className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 ${
              audience.status === "archived" ? "border-neutral-200 opacity-60 bg-neutral-50/50" : "border-neutral-200/80 hover:border-neutral-300"
            }`}
          >
            <div className="space-y-4">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm leading-snug">{audience.name}</h3>
                    <span className="text-[11px] font-medium text-neutral-500">{audience.jobTitle || "Decision Maker"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {audience.status === "archived" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                      Archived
                    </span>
                  )}
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(audience)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Edit Persona"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleArchive(audience.id)}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title={audience.status === "active" ? "Archive Persona" : "Restore Persona"}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Pain Points */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Core Pain Points
                </span>
                <div className="bg-rose-50/40 border border-rose-100 rounded-lg p-2.5 space-y-1 text-xs text-neutral-700">
                  {audience.painPoints && audience.painPoints.length > 0 ? (
                    audience.painPoints.map((p, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-rose-500 font-bold">•</span>
                        <span>{p}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-neutral-400 italic">No pain points listed</span>
                  )}
                </div>
              </div>

              {/* Goals */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Desired Outcomes & Goals
                </span>
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-lg p-2.5 space-y-1 text-xs text-neutral-700">
                  {audience.goals && audience.goals.length > 0 ? (
                    audience.goals.map((g, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{g}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-neutral-400 italic">No goals listed</span>
                  )}
                </div>
              </div>

              {/* Objections */}
              {audience.objections && audience.objections.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Potential Objections
                  </span>
                  <div className="bg-amber-50/40 border border-amber-100 rounded-lg p-2.5 space-y-1 text-xs text-neutral-700">
                    {audience.objections.map((obj, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-500 font-bold">•</span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferred Channels */}
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase flex items-center gap-1">
                  <Radio className="w-3 h-3" /> Channels
                </span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {audience.preferredChannels && audience.preferredChannels.length > 0 ? (
                    audience.preferredChannels.map((ch, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 text-neutral-700 font-medium">
                        {ch}
                      </span>
                    ))
                  ) : (
                    <span className="text-neutral-400 italic">Web / Search</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredAudiences.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-neutral-200 space-y-3">
          <Users className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-sm font-medium text-neutral-600">No audience personas found matching filter</p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isEditing && currentAudience && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">
                {currentAudience.id ? "Edit Audience Persona" : "Create Audience Persona"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Persona Name *</label>
                  <input
                    type="text"
                    required
                    value={currentAudience.name || ""}
                    onChange={(e) => setCurrentAudience({ ...currentAudience, name: e.target.value })}
                    placeholder="e.g. VP Demand Gen"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Job Title</label>
                  <input
                    type="text"
                    value={currentAudience.jobTitle || ""}
                    onChange={(e) => setCurrentAudience({ ...currentAudience, jobTitle: e.target.value })}
                    placeholder="e.g. VP Marketing / Growth Lead"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>

              {/* Pain Points Builder */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700">Pain Points</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={painInput}
                    onChange={(e) => setPainInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem("painPoints", painInput, setPainInput);
                      }
                    }}
                    placeholder="Type pain point & press Add"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => addItem("painPoints", painInput, setPainInput)}
                    className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1 pt-1">
                  {(currentAudience.painPoints || []).map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-neutral-50 px-2.5 py-1.5 rounded border border-neutral-200">
                      <span>{p}</span>
                      <button type="button" onClick={() => removeItem("painPoints", idx)} className="text-neutral-400 hover:text-rose-600 font-bold">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals Builder */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700">Desired Goals</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem("goals", goalInput, setGoalInput);
                      }
                    }}
                    placeholder="Type goal & press Add"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => addItem("goals", goalInput, setGoalInput)}
                    className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1 pt-1">
                  {(currentAudience.goals || []).map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-neutral-50 px-2.5 py-1.5 rounded border border-neutral-200">
                      <span>{g}</span>
                      <button type="button" onClick={() => removeItem("goals", idx)} className="text-neutral-400 hover:text-rose-600 font-bold">×</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Channels Builder */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700">Preferred Channels</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem("preferredChannels", channelInput, setChannelInput);
                      }
                    }}
                    placeholder="e.g. LinkedIn, GitHub, Substacks"
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => addItem("preferredChannels", channelInput, setChannelInput)}
                    className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 font-semibold"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {(currentAudience.preferredChannels || []).map((ch, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 font-medium">
                      {ch}
                      <button type="button" onClick={() => removeItem("preferredChannels", idx)} className="text-neutral-400 hover:text-rose-600 font-bold">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {saving ? "Saving..." : "Save Persona"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
