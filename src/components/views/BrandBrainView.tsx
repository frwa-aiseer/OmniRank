import { useState, useEffect } from "react";
import {
  Brain,
  Building2,
  Users,
  Mic,
  BookOpen,
  ShieldAlert,
  Swords,
  History,
  Sparkles,
  RefreshCw,
  Lock,
  CheckCircle,
  UploadCloud,
  Award
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import {
  BrandBrainKnowledge,
  BrandProduct,
  BrandAudience,
  BrandVoiceProfile,
  BrandVoiceExample,
  BrandTerminology,
  BrandPolicy,
  BrandCompetitor
} from "../../types";
import { brandBrainApi } from "../../services/brandBrainApi";

import { OverviewTab } from "../brand-brain/OverviewTab";
import { SourcesTab } from "../brand-brain/SourcesTab";
import { EvidenceTab } from "../brand-brain/EvidenceTab";
import { ProductsTab } from "../brand-brain/ProductsTab";
import { AudiencesTab } from "../brand-brain/AudiencesTab";
import { VoiceTab } from "../brand-brain/VoiceTab";
import { TerminologyTab } from "../brand-brain/TerminologyTab";
import { PoliciesTab } from "../brand-brain/PoliciesTab";
import { CompetitorsTab } from "../brand-brain/CompetitorsTab";
import { AuditLogTab } from "../brand-brain/AuditLogTab";

type BrandBrainSubTab =
  | "overview"
  | "sources"
  | "evidence"
  | "products"
  | "audiences"
  | "voice"
  | "terminology"
  | "policies"
  | "competitors"
  | "audit-log";

export function BrandBrainView() {
  const { currentUser, currentBrand, currentOrg } = useApp();
  const [activeTab, setActiveTab] = useState<BrandBrainSubTab>("overview");
  const [knowledge, setKnowledge] = useState<BrandBrainKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const brandId = currentBrand?.id || "brand-001";
  const user = {
    id: currentUser.id,
    name: currentUser.fullName
  };

  const isStrategistOrAdmin =
    currentUser.orgRole === "owner" ||
    currentUser.orgRole === "admin" ||
    currentUser.brandRole === "strategist";

  const isWriterOrAbove =
    isStrategistOrAdmin || currentUser.brandRole === "writer";

  // Load Brand Brain Data
  const loadKnowledge = async () => {
    try {
      setLoading(true);
      const data = await brandBrainApi.getKnowledge(brandId, user.id);
      if (data) {
        setKnowledge(data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledge();
  }, [brandId]);

  const showNotification = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Handlers for Products
  const handleSaveProduct = async (productData: Partial<BrandProduct>) => {
    await brandBrainApi.saveProduct(brandId, productData, user.id);
    showNotification(productData.id ? `Updated product "${productData.name}".` : `Created product "${productData.name}".`);
    loadKnowledge();
  };

  const handleToggleArchiveProduct = async (productId: string) => {
    const res = await brandBrainApi.toggleArchiveProduct(brandId, productId, user.id);
    showNotification(`${res.product?.status === "archived" ? "Archived" : "Restored"} product.`);
    loadKnowledge();
  };

  // Handlers for Audiences
  const handleSaveAudience = async (audienceData: Partial<BrandAudience>) => {
    await brandBrainApi.saveAudience(brandId, audienceData, user.id);
    showNotification(audienceData.id ? `Updated persona "${audienceData.name}".` : `Created persona "${audienceData.name}".`);
    loadKnowledge();
  };

  const handleToggleArchiveAudience = async (audienceId: string) => {
    const res = await brandBrainApi.toggleArchiveAudience(brandId, audienceId, user.id);
    showNotification(`${res.audience?.status === "archived" ? "Archived" : "Restored"} persona.`);
    loadKnowledge();
  };

  // Handlers for Voice
  const handleSaveVoiceProfile = async (updates: Partial<BrandVoiceProfile>) => {
    await brandBrainApi.saveVoiceProfile(brandId, updates, user.id);
    showNotification("Brand Voice parameters and style guidelines updated.");
    loadKnowledge();
  };

  const handleAddVoiceExample = async (example: Omit<BrandVoiceExample, "id" | "brandId" | "createdAt">) => {
    await brandBrainApi.addVoiceExample(brandId, example, user.id);
    showNotification(`Added ${example.type.toUpperCase()} voice example: "${example.title}".`);
    loadKnowledge();
  };

  const handleDeleteVoiceExample = async (exampleId: string) => {
    await brandBrainApi.deleteVoiceExample(brandId, exampleId, user.id);
    showNotification("Voice example removed.");
    loadKnowledge();
  };

  // Handlers for Terminology
  const handleSaveTerminology = async (data: Omit<BrandTerminology, "id" | "brandId" | "createdAt">) => {
    await brandBrainApi.saveTerminology(brandId, data, user.id);
    showNotification(`Registered ${data.type} term "${data.term}".`);
    loadKnowledge();
  };

  const handleToggleArchiveTerminology = async (termId: string) => {
    const res = await brandBrainApi.toggleArchiveTerminology(brandId, termId, user.id);
    showNotification(`${res.term?.status === "archived" ? "Archived" : "Restored"} terminology item.`);
    loadKnowledge();
  };

  // Handlers for Policies
  const handleSavePolicy = async (policyData: Partial<BrandPolicy>) => {
    await brandBrainApi.savePolicy(brandId, policyData, user.id);
    showNotification(policyData.id ? `Updated policy "${policyData.title}".` : `Defined ${policyData.severity?.toUpperCase()} policy "${policyData.title}".`);
    loadKnowledge();
  };

  const handleToggleArchivePolicy = async (policyId: string) => {
    const res = await brandBrainApi.toggleArchivePolicy(brandId, policyId, user.id);
    showNotification(`${res.policy?.status === "archived" ? "Archived" : "Restored"} policy.`);
    loadKnowledge();
  };

  // Handlers for Competitors
  const handleSaveCompetitor = async (compData: Partial<BrandCompetitor>) => {
    await brandBrainApi.saveCompetitor(brandId, compData, user.id);
    showNotification(compData.id ? `Updated competitor "${compData.name}".` : `Added competitor "${compData.name}".`);
    loadKnowledge();
  };

  const handleToggleArchiveCompetitor = async (competitorId: string) => {
    const res = await brandBrainApi.toggleArchiveCompetitor(brandId, competitorId, user.id);
    showNotification(`${res.competitor?.status === "archived" ? "Archived" : "Restored"} competitor.`);
    loadKnowledge();
  };

  const tabs: { id: BrandBrainSubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: Brain },
    { id: "sources", label: "Sources & Ingestion", icon: UploadCloud },
    { id: "evidence", label: "Evidence & Claims", icon: Award },
    { id: "products", label: "Products & Services", icon: Building2 },
    { id: "audiences", label: "Audiences", icon: Users },
    { id: "voice", label: "Brand Voice", icon: Mic },
    { id: "terminology", label: "Terminology", icon: BookOpen },
    { id: "policies", label: "Brand Policies", icon: ShieldAlert },
    { id: "competitors", label: "Competitors", icon: Swords },
    { id: "audit-log", label: "Audit Log", icon: History }
  ];

  return (
    <div id="brand-brain-view" className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header answering UX principle: "What does OmniRank know about us?" */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <Brain className="w-4 h-4" />
            <span>Brand Intelligence</span>
            <span className="text-neutral-300">•</span>
            <span className="text-neutral-500 capitalize">{currentBrand?.name || "Acme AI Cloud"}</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What does OmniRank know about us?</h1>
          <p className="text-xs text-neutral-500 max-w-2xl">
            The foundational Brand Brain of voice guidelines, offerings, audiences, policies, and competitive differentiators.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isStrategistOrAdmin && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 text-xs font-medium">
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{currentUser.brandRole === "writer" ? "Writer Mode (Contribute Only)" : "Viewer Mode (Read Only)"}</span>
            </div>
          )}
          <button
            onClick={loadKnowledge}
            className="p-2 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
            title="Reload Knowledge"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-600 uppercase font-semibold">Audit logged</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-200/80 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      {knowledge ? (
        <div className="pt-2">
          {activeTab === "overview" && (
            <OverviewTab
              knowledge={knowledge}
              onNavigateTab={(tab) => setActiveTab(tab as BrandBrainSubTab)}
              canEdit={isStrategistOrAdmin}
            />
          )}

          {activeTab === "sources" && (
            <SourcesTab
              brandId={brandId}
              sources={knowledge.sources || []}
              documents={knowledge.documents || []}
              isStrategistOrAdmin={isStrategistOrAdmin}
              isWriterOrAbove={isWriterOrAbove}
              onRefresh={loadKnowledge}
              onNotify={showNotification}
            />
          )}

          {activeTab === "evidence" && (
            <EvidenceTab
              brandId={brandId}
              claims={knowledge.evidenceClaims || []}
              sources={knowledge.evidenceSources || []}
              isStrategistOrAdmin={isStrategistOrAdmin}
              onRefresh={loadKnowledge}
              onNotify={showNotification}
            />
          )}

          {activeTab === "products" && (
            <ProductsTab
              products={knowledge.products}
              canEdit={isWriterOrAbove}
              onSaveProduct={handleSaveProduct}
              onToggleArchive={handleToggleArchiveProduct}
            />
          )}

          {activeTab === "audiences" && (
            <AudiencesTab
              audiences={knowledge.audiences}
              canEdit={isStrategistOrAdmin}
              onSaveAudience={handleSaveAudience}
              onToggleArchive={handleToggleArchiveAudience}
            />
          )}

          {activeTab === "voice" && (
            <VoiceTab
              voiceProfile={knowledge.voiceProfile}
              voiceExamples={knowledge.voiceExamples}
              canEdit={isWriterOrAbove}
              onSaveVoiceProfile={handleSaveVoiceProfile}
              onAddVoiceExample={handleAddVoiceExample}
              onDeleteVoiceExample={handleDeleteVoiceExample}
            />
          )}

          {activeTab === "terminology" && (
            <TerminologyTab
              terminology={knowledge.terminology}
              canEdit={isWriterOrAbove}
              onSaveTerminology={handleSaveTerminology}
              onToggleArchive={handleToggleArchiveTerminology}
            />
          )}

          {activeTab === "policies" && (
            <PoliciesTab
              policies={knowledge.policies}
              canEdit={isStrategistOrAdmin}
              onSavePolicy={handleSavePolicy}
              onToggleArchive={handleToggleArchivePolicy}
            />
          )}

          {activeTab === "competitors" && (
            <CompetitorsTab
              competitors={knowledge.competitors}
              canEdit={isStrategistOrAdmin}
              onSaveCompetitor={handleSaveCompetitor}
              onToggleArchive={handleToggleArchiveCompetitor}
            />
          )}

          {activeTab === "audit-log" && (
            <AuditLogTab logs={knowledge.recentAuditLogs} />
          )}
        </div>
      ) : (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-xs text-neutral-500 font-medium">Loading Brand Brain Knowledge...</p>
        </div>
      )}
    </div>
  );
}
