import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.tsx";
import { Opportunity, OpportunityStatus, OpportunityType } from "../../types/opportunity.ts";
import { AlertCircle, FilePlus2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase/client.ts";

export const OpportunitiesView: React.FC = () => {
  const { currentBrand, setCurrentView } = useApp();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState<OpportunityType | "all">("all");

  const fetchOpps = async () => {
    if (!currentBrand || currentBrand.id === "00000000-0000-0000-0000-000000000000") return;
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "demo-token";
      
      const res = await fetch(`/api/opportunities/${currentBrand.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpps();
  }, [currentBrand]);

  const generateOpps = async () => {
    if (!currentBrand || currentBrand.id === "00000000-0000-0000-0000-000000000000") return;
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "demo-token";
      
      const res = await fetch(`/api/opportunities/${currentBrand.id}/generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchOpps();
      }
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!currentBrand || currentBrand.id === "00000000-0000-0000-0000-000000000000") return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "demo-token";
      
      const res = await fetch(`/api/opportunities/${currentBrand.id}/${id}/${status}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchOpps();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const createRelatedArticle = async (opp: Opportunity) => {
    if (!currentBrand || currentBrand.id === "00000000-0000-0000-0000-000000000000") return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "demo-token";
      
      const res = await fetch(`/api/opportunities/${currentBrand.id}/${opp.id}/create-article`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCurrentView("content");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = filter === "all" ? opportunities : opportunities.filter(o => o.type === filter);
  
  const displayOpps = filtered.filter(o => o.status === 'new' || o.status === 'accepted' || o.status === 'in_progress');

  if (loading && opportunities.length === 0) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">What should I do next?</h1>
          <p className="text-muted-foreground mt-2">Data-driven content and brand recommendations</p>
        </div>
        <button onClick={generateOpps} disabled={generating} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
          <RefreshCw className={generating ? "animate-spin w-4 h-4" : "w-4 h-4"} />
          Detect Opportunities
        </button>
      </div>

      <div className="flex gap-2 pb-4 overflow-x-auto">
        {(["all", "new_content", "refresh_content", "content_gap", "internal_link", "evidence_gap", "brand_knowledge_gap"] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`capitalize px-3 py-1 text-sm border rounded-md ${filter === type ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"}`}
          >
            {type === "all" ? "All" : type.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {displayOpps.length === 0 ? (
          <div className="text-center p-12 border rounded-lg bg-white shadow-sm">
            <h3 className="text-lg font-medium">No active opportunities found</h3>
            <p className="text-neutral-500 mt-2">Run detection to find new recommendations.</p>
          </div>
        ) : (
          displayOpps.map(opp => (
            <div key={opp.id} className="p-6 border rounded-lg bg-white flex flex-col md:flex-row gap-6 items-start shadow-sm">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 capitalize">
                    {opp.type.replace("_", " ")}
                  </span>
                  <span className="text-sm font-medium text-neutral-500">Priority: {opp.priorityScore}</span>
                </div>
                <h3 className="text-xl font-bold text-neutral-900">{opp.title}</h3>
                <p className="text-neutral-600">{opp.summary}</p>
                <div className="text-sm bg-neutral-50 p-3 rounded mt-2 text-neutral-700">
                  <span className="font-semibold block mb-1">Why it matters:</span>
                  {opp.rationale}
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-500 pt-2">
                  <span>Impact: {opp.impactScore}</span>
                  <span>Confidence: {opp.confidenceScore}</span>
                  <span>Effort: {opp.effortScore}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 min-w-[140px]">
                {opp.status === 'new' && (
                  <>
                    <button onClick={() => updateStatus(opp.id, "accept")} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Accept
                    </button>
                    <button onClick={() => updateStatus(opp.id, "dismiss")} className="flex items-center justify-center px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded hover:bg-rose-50 w-full">
                      <XCircle className="w-4 h-4 mr-2" /> Dismiss
                    </button>
                  </>
                )}
                {(opp.status === 'accepted' || opp.status === 'in_progress') && (
                  <>
                    {(opp.type === 'new_content' || opp.type === 'content_gap') && (
                      <button onClick={() => createRelatedArticle(opp)} className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 w-full">
                        <FilePlus2 className="w-4 h-4 mr-2" /> Start Draft
                      </button>
                    )}
                    <button onClick={() => updateStatus(opp.id, "complete")} className="flex items-center justify-center px-4 py-2 bg-white border border-neutral-300 text-neutral-700 rounded hover:bg-neutral-50 w-full">
                      Mark Completed
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
