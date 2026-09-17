import { useState } from "react";
import { Mic, Plus, Trash2, CheckCircle, XCircle, Sliders, Sparkles, BookOpen, Layers } from "lucide-react";
import { BrandVoiceProfile, BrandVoiceExample } from "../../types";

interface VoiceTabProps {
  voiceProfile: BrandVoiceProfile;
  voiceExamples: BrandVoiceExample[];
  canEdit: boolean;
  onSaveVoiceProfile: (updates: Partial<BrandVoiceProfile>) => Promise<void>;
  onAddVoiceExample: (example: Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">) => Promise<void>;
  onDeleteVoiceExample: (exampleId: string) => Promise<void>;
}

export function VoiceTab({
  voiceProfile,
  voiceExamples,
  canEdit,
  onSaveVoiceProfile,
  onAddVoiceExample,
  onDeleteVoiceExample
}: VoiceTabProps) {
  const [profileForm, setProfileForm] = useState<BrandVoiceProfile>({ ...voiceProfile });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // New Voice Example state
  const [isAddingExample, setIsAddingExample] = useState(false);
  const [exampleForm, setExampleForm] = useState<Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">>({
    type: "do",
    title: "",
    snippet: "",
    explanation: "",
    category: "Technical Explanation"
  });
  const [savingExample, setSavingExample] = useState(false);

  const doExamples = voiceExamples.filter((e) => e.type === "do");
  const dontExamples = voiceExamples.filter((e) => e.type === "dont");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onSaveVoiceProfile(profileForm);
      setIsEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateExample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exampleForm.title || !exampleForm.snippet) return;
    setSavingExample(true);
    try {
      await onAddVoiceExample(exampleForm);
      setIsAddingExample(false);
      setExampleForm({
        type: "do",
        title: "",
        snippet: "",
        explanation: "",
        category: "Technical Explanation"
      });
    } finally {
      setSavingExample(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Voice Profile Settings */}
      <div className="bg-white rounded-xl border border-neutral-200/80 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900">Brand Voice & Style Archetype</h2>
              <p className="text-xs text-neutral-500">
                Calibrate tone parameters, technical depth, and reading level for all content generation.
              </p>
            </div>
          </div>

          {canEdit && !isEditingProfile && (
            <button
              onClick={() => {
                setProfileForm({ ...voiceProfile });
                setIsEditingProfile(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Calibrate Voice</span>
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Brand Voice Archetype *</label>
                <input
                  type="text"
                  required
                  value={profileForm.archetype}
                  onChange={(e) => setProfileForm({ ...profileForm, archetype: e.target.value })}
                  placeholder="e.g. The Pragmatic Systems Architect"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target Reading Grade Level</label>
                <input
                  type="text"
                  value={profileForm.readingGradeLevel}
                  onChange={(e) => setProfileForm({ ...profileForm, readingGradeLevel: e.target.value })}
                  placeholder="e.g. Professional / Grade 11-12"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>
            </div>

            {/* Sliders for Tone Traits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-neutral-700">
                  <span>Formality</span>
                  <span className="text-indigo-600 font-bold">{profileForm.formalityScore} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={profileForm.formalityScore}
                  onChange={(e) => setProfileForm({ ...profileForm, formalityScore: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-neutral-400">1: Casual → 5: Academic</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-neutral-700">
                  <span>Enthusiasm</span>
                  <span className="text-indigo-600 font-bold">{profileForm.enthusiasmScore} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={profileForm.enthusiasmScore}
                  onChange={(e) => setProfileForm({ ...profileForm, enthusiasmScore: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-neutral-400">1: Understated → 5: High Energy</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-neutral-700">
                  <span>Technical Depth</span>
                  <span className="text-indigo-600 font-bold">{profileForm.technicalDepthScore} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={profileForm.technicalDepthScore}
                  onChange={(e) => setProfileForm({ ...profileForm, technicalDepthScore: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-neutral-400">1: Layman → 5: Deep Code</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-semibold text-neutral-700">
                  <span>Humor & Wit</span>
                  <span className="text-indigo-600 font-bold">{profileForm.humorScore} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={profileForm.humorScore}
                  onChange={(e) => setProfileForm({ ...profileForm, humorScore: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <span className="text-[10px] text-neutral-400">1: None → 5: Witty</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-neutral-700">Style Guidelines & Directives</label>
              <textarea
                rows={3}
                value={profileForm.styleGuidelines}
                onChange={(e) => setProfileForm({ ...profileForm, styleGuidelines: e.target.value })}
                placeholder="Key directives for voice, sentence structure, active vs passive voice..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                {savingProfile ? "Saving..." : "Update Voice Profile"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Archetype</span>
                <p className="text-xs font-bold text-neutral-900">{voiceProfile.archetype}</p>
                <span className="text-[11px] text-neutral-500">{voiceProfile.readingGradeLevel}</span>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Formality</span>
                  <span className="font-bold text-indigo-600">{voiceProfile.formalityScore} / 5</span>
                </div>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(voiceProfile.formalityScore / 5) * 100}%` }} />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Technical Depth</span>
                  <span className="font-bold text-indigo-600">{voiceProfile.technicalDepthScore} / 5</span>
                </div>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(voiceProfile.technicalDepthScore / 5) * 100}%` }} />
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-neutral-700">
                  <span>Enthusiasm</span>
                  <span className="font-bold text-indigo-600">{voiceProfile.enthusiasmScore} / 5</span>
                </div>
                <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${(voiceProfile.enthusiasmScore / 5) * 100}%` }} />
                </div>
              </div>
            </div>

            <div className="p-4 bg-neutral-50/70 rounded-xl border border-neutral-100 text-xs space-y-1.5">
              <span className="font-semibold uppercase tracking-wider text-neutral-400 text-[10px]">Editorial Directives</span>
              <p className="text-neutral-700 leading-relaxed">{voiceProfile.styleGuidelines}</p>
            </div>
          </div>
        )}
      </div>

      {/* Voice Examples: Do's & Don'ts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900">Voice Examples (Do's & Don'ts)</h3>
            <p className="text-xs text-neutral-500">
              Gold standard benchmark snippets versus banned phrasing patterns.
            </p>
          </div>

          {canEdit && (
            <button
              id="btn-add-voice-example"
              onClick={() => setIsAddingExample(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Example</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* DO Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Recommended ("DO") Examples ({doExamples.length})</span>
            </div>

            <div className="space-y-3">
              {doExamples.map((ex) => (
                <div key={ex.id} className="bg-white rounded-xl border border-emerald-200/80 p-4 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-900 text-xs">{ex.title}</h4>
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {ex.category}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onDeleteVoiceExample(ex.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1 rounded"
                        title="Delete Example"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <blockquote className="text-xs text-neutral-800 bg-emerald-50/40 p-3 rounded-lg border-l-2 border-emerald-500 italic">
                    "{ex.snippet}"
                  </blockquote>

                  <p className="text-[11px] text-neutral-600 flex items-start gap-1">
                    <span className="font-semibold text-neutral-700 shrink-0">Why it works:</span>
                    <span>{ex.explanation}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* DONT Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700 uppercase tracking-wider">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Prohibited ("DON'T") Patterns ({dontExamples.length})</span>
            </div>

            <div className="space-y-3">
              {dontExamples.map((ex) => (
                <div key={ex.id} className="bg-white rounded-xl border border-rose-200/80 p-4 shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-neutral-900 text-xs">{ex.title}</h4>
                      <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        {ex.category}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onDeleteVoiceExample(ex.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1 rounded"
                        title="Delete Example"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <blockquote className="text-xs text-neutral-800 bg-rose-50/40 p-3 rounded-lg border-l-2 border-rose-500 italic">
                    "{ex.snippet}"
                  </blockquote>

                  <p className="text-[11px] text-neutral-600 flex items-start gap-1">
                    <span className="font-semibold text-neutral-700 shrink-0">Why it fails:</span>
                    <span>{ex.explanation}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Example Modal */}
      {isAddingExample && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-base font-bold text-neutral-900">Add Voice Example</h3>
              <button onClick={() => setIsAddingExample(false)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            <form onSubmit={handleCreateExample} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Example Type</label>
                  <select
                    value={exampleForm.type}
                    onChange={(e) => setExampleForm({ ...exampleForm, type: e.target.value as "do" | "dont" })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  >
                    <option value="do">Recommended (DO)</option>
                    <option value="dont">Prohibited (DON'T)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-neutral-700">Category</label>
                  <input
                    type="text"
                    value={exampleForm.category}
                    onChange={(e) => setExampleForm({ ...exampleForm, category: e.target.value })}
                    placeholder="e.g. Technical Explanation, Intro, CTA"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Example Title *</label>
                <input
                  type="text"
                  required
                  value={exampleForm.title}
                  onChange={(e) => setExampleForm({ ...exampleForm, title: e.target.value })}
                  placeholder="e.g. Architecture Comparison with Precision"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Snippet Text *</label>
                <textarea
                  rows={3}
                  required
                  value={exampleForm.snippet}
                  onChange={(e) => setExampleForm({ ...exampleForm, snippet: e.target.value })}
                  placeholder="The exact sentence or paragraph snippet..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Editorial Rationale *</label>
                <textarea
                  rows={2}
                  required
                  value={exampleForm.explanation}
                  onChange={(e) => setExampleForm({ ...exampleForm, explanation: e.target.value })}
                  placeholder="Explain why this demonstrates excellent (or bad) brand voice..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddingExample(false)}
                  className="px-3 py-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingExample}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  {savingExample ? "Saving..." : "Add Example"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
