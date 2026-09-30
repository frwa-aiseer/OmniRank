import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.tsx";

export function ResearchView() {
  const { currentUser, currentBrand } = useApp();
  // Assume we have session in another way, or just pass a dummy token if not live
  const token = "demo-token"; // Using generic token mechanism for demo unless full auth is there
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  useEffect(() => {
    if (currentBrand) {
      fetch(`/api/research/${currentBrand.id}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProjects(data);
      });
    }
  }, [currentBrand]);

  if (!selectedProject) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Research Projects</h1>
        <div className="grid gap-4">
          {projects.map(p => (
            <div key={p.id} className="p-4 bg-white rounded shadow cursor-pointer hover:bg-gray-50" onClick={() => setSelectedProject(p)}>
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-sm text-gray-600">Mode: {p.mode} | Status: {p.status}</p>
            </div>
          ))}
          {projects.length === 0 && <p className="text-gray-500">No research projects yet.</p>}
        </div>
      </div>
    );
  }

  // 3-Pane Layout
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="p-4 border-b bg-white flex justify-between items-center shrink-0">
        <div>
          <button onClick={() => setSelectedProject(null)} className="text-sm text-blue-600 hover:underline mr-4">
            &larr; Back
          </button>
          <span className="font-semibold text-lg">{selectedProject.title}</span>
        </div>
        <div className="space-x-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">Mode: {selectedProject.mode}</span>
          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">Status: {selectedProject.status}</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Questions */}
        <div className="w-1/3 border-r bg-gray-50 overflow-y-auto p-4 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-700">Questions & Plan</h2>
          <div className="p-3 bg-white rounded border text-sm text-gray-600">
            [Questions list would render here]
          </div>
        </div>

        {/* CENTER: Findings */}
        <div className="w-1/3 border-r bg-white overflow-y-auto p-4 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-700">Findings & Brief</h2>
          <div className="p-3 bg-gray-50 rounded border border-dashed text-sm text-gray-600">
            [Content Brief Editor / Findings mapping]
          </div>
        </div>

        {/* RIGHT: Evidence */}
        <div className="w-1/3 bg-gray-50 overflow-y-auto p-4 flex flex-col gap-4">
          <h2 className="font-semibold text-gray-700">Sources & Evidence</h2>
          <div className="p-3 bg-white rounded border text-sm text-gray-600">
            [Source inspector would render here]
          </div>
        </div>
      </div>
    </div>
  );
}
