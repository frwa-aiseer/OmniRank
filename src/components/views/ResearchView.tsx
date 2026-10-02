import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.tsx";
import { supabase } from "../../lib/supabase/client.ts";
import { ResearchProject, ResearchQuestion, ResearchSource, ResearchFinding, ContentBrief } from "../../types/research.ts";

export function ResearchView() {
  const { currentBrand, currentOrg } = useApp();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<ResearchProject | null>(null);
  
  const [questions, setQuestions] = useState<ResearchQuestion[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [findings, setFindings] = useState<ResearchFinding[]>([]);
  const [brief, setBrief] = useState<ContentBrief | null>(null);
  
  const [loading, setLoading] = useState(false);

  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
    let token = sessionData.session?.access_token;
    
    if (!token) {
      if (isDemoMode) {
        token = "demo-token";
      } else {
        throw new Error("Authentication required for live mode");
      }
    }

    return fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` }
    });
  };

  useEffect(() => {
    if (currentBrand) {
      fetchWithAuth(`/api/research/${currentBrand.id}/projects`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setProjects(data);
        }).catch(err => console.error(err));
    }
  }, [currentBrand]);

  const loadProjectDetails = async (project: ResearchProject) => {
    if (!currentBrand) return;
    setLoading(true);
    try {
      const [qRes, sRes, fRes, pRes] = await Promise.all([
        fetchWithAuth(`/api/research/${currentBrand.id}/projects/${project.id}/questions`),
        fetchWithAuth(`/api/research/${currentBrand.id}/projects/${project.id}/sources`),
        fetchWithAuth(`/api/research/${currentBrand.id}/projects/${project.id}/findings`),
        fetchWithAuth(`/api/research/${currentBrand.id}/projects/${project.id}`)
      ]);
      setQuestions(await qRes.json());
      setSources(await sRes.json());
      setFindings(await fRes.json());
      const pData = await pRes.json();
      setBrief(pData.brief || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectProject = (project: ResearchProject) => {
    setSelectedProject(project);
    loadProjectDetails(project);
  };

  const createManualProject = async () => {
    if (!currentBrand || !currentOrg) return;
    try {
      const res = await fetchWithAuth(`/api/research/${currentBrand.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          title: "Manual Research Project",
          objective: "Explore new topics",
          mode: "standard"
        })
      });
      if (res.ok) {
        const p = await res.json();
        setProjects([...projects, p]);
        selectProject(p);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const prepareBrief = async () => {
    if (!currentBrand || !currentOrg || !selectedProject) return;
    try {
      const res = await fetchWithAuth(`/api/research/${currentBrand.id}/projects/${selectedProject.id}/brief/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id })
      });
      if (res.ok) {
        const b = await res.json();
        setBrief(b);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!selectedProject) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Research Projects</h1>
          <button onClick={createManualProject} className="bg-indigo-600 text-white px-4 py-2 rounded shadow text-sm font-medium hover:bg-indigo-700">
            + New Manual Project
          </button>
        </div>
        <div className="grid gap-4">
          {projects.map(p => (
            <div key={p.id} className="p-4 bg-white rounded shadow cursor-pointer hover:bg-gray-50 border" onClick={() => selectProject(p)}>
              <h3 className="font-semibold text-lg">{p.title}</h3>
              <p className="text-sm text-gray-600 mt-1">{p.objective}</p>
              <div className="flex gap-2 mt-3 text-xs">
                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md">Mode: {p.mode}</span>
                <span className="px-2 py-1 bg-neutral-100 text-neutral-700 rounded-md capitalize">{p.status}</span>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-gray-500 text-center py-10 bg-white rounded border border-dashed">No research projects found.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b bg-white flex justify-between items-center shrink-0">
        <div>
          <button onClick={() => setSelectedProject(null)} className="text-sm text-indigo-600 hover:underline mr-4 font-medium">
            &larr; Back to Projects
          </button>
          <span className="font-semibold text-lg text-neutral-900">{selectedProject.title}</span>
        </div>
        <div className="space-x-2">
          <button onClick={prepareBrief} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
            Prepare Brief
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Questions */}
        <div className="w-1/3 border-r bg-neutral-50 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-neutral-900">Questions & Plan</h2>
            <button className="text-xs text-indigo-600 hover:underline">+ Add</button>
          </div>
          {questions.map(q => (
            <div key={q.id} className="p-3 bg-white rounded shadow-sm border border-neutral-200 text-sm">
              <p className="font-medium text-neutral-800">{q.questionText}</p>
              <div className="mt-2 flex justify-between text-xs text-neutral-500 capitalize">
                <span>{q.status} • {q.originType}</span>
                <button className="text-indigo-500 hover:underline">Update</button>
              </div>
            </div>
          ))}
          {questions.length === 0 && <div className="text-sm text-neutral-500">No questions mapped yet.</div>}
        </div>

        {/* CENTER: Findings & Brief */}
        <div className="w-1/3 border-r bg-white overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-neutral-900">Findings & Content Brief</h2>
            <button className="text-xs text-indigo-600 hover:underline">+ Add Finding</button>
          </div>
          
          {brief ? (
            <div className="p-4 bg-indigo-50 rounded border border-indigo-100 text-sm relative group">
              <button className="absolute top-2 right-2 text-xs bg-white text-indigo-600 px-2 py-1 rounded shadow-sm hidden group-hover:block border">Edit Brief</button>
              <h3 className="font-bold text-indigo-900 mb-2">Draft Content Brief</h3>
              <div className="space-y-2">
                <p><span className="font-semibold">Title:</span> {brief.title}</p>
                <p><span className="font-semibold">Angle:</span> {brief.angle}</p>
                <p><span className="font-semibold">Target Keyword:</span> {brief.targetKeyword || 'None'}</p>
                <div>
                  <span className="font-semibold">Outline:</span>
                  <ul className="list-disc pl-4 mt-1">
                    {brief.outline?.map((item: any, i: number) => (
                      <li key={i}>{item.heading}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-indigo-200 pt-3">
                 <button className="text-xs bg-white border border-neutral-300 text-neutral-700 px-3 py-1 rounded">Review</button>
                 <button className="text-xs bg-indigo-600 text-white px-3 py-1 rounded">Finalize</button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-neutral-50 border border-dashed rounded text-sm text-neutral-500 text-center">
              No brief generated yet.
            </div>
          )}

          <h3 className="font-semibold text-neutral-700 mt-4">Verified Findings</h3>
          {findings.map(f => (
            <div key={f.id} className={`p-3 rounded border text-sm relative group ${f.supportStatus === 'unsupported' ? 'bg-rose-50 border-rose-200' : 'bg-white border-neutral-200 shadow-sm'}`}>
              <button className="absolute top-2 right-2 text-xs bg-white border shadow-sm px-2 py-1 rounded hidden group-hover:block">Review</button>
              <p className="font-medium text-neutral-800">{f.findingText}</p>
              <div className="mt-2 text-xs text-neutral-500 capitalize">
                Status: {f.supportStatus.replace('_', ' ')} • Score: {f.confidenceScore}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: Evidence */}
        <div className="w-1/3 bg-neutral-50 overflow-y-auto p-4 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-neutral-900">Sources & Evidence</h2>
            <button className="text-xs text-indigo-600 hover:underline">+ Add Source</button>
          </div>
          {sources.map(s => (
            <div key={s.id} className="p-3 bg-white rounded shadow-sm border border-neutral-200 text-sm">
              <h4 className="font-medium text-neutral-800">{s.title}</h4>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline block mt-1 truncate">{s.url}</a>}
              <div className="mt-2 text-[11px] px-2 py-0.5 bg-neutral-100 text-neutral-600 inline-block rounded capitalize">
                {s.classification.replace('_', ' ')}
              </div>
            </div>
          ))}
          {sources.length === 0 && <div className="text-sm text-neutral-500">No sources collected yet.</div>}
        </div>
      </div>
    </div>
  );
}
