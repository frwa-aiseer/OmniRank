import { Settings, Shield, Server, Database } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function SettingsView() {
  const { currentOrg, currentBrand, currentUser } = useApp();

  return (
    <div id="settings-view" className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
          <Settings className="w-4 h-4" />
          <span>System & Tenancy</span>
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Organization & Brand Settings</h1>
        <p className="text-sm text-neutral-500">
          Multi-tenant boundaries, Row Level Security isolation, and backend connection states.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-200 shadow-xs">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 text-sm">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Active Tenant Boundary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
              <span className="text-neutral-500 font-medium">Organization</span>
              <div className="font-semibold text-neutral-800">{currentOrg.name}</div>
              <div className="text-[10px] text-neutral-400 font-mono">ID: {currentOrg.id}</div>
            </div>
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1">
              <span className="text-neutral-500 font-medium">Brand</span>
              <div className="font-semibold text-neutral-800">{currentBrand.name}</div>
              <div className="text-[10px] text-neutral-400 font-mono">ID: {currentBrand.id}</div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-neutral-900 text-sm">
            <Server className="w-4 h-4 text-indigo-600" />
            <span>User Permissions & Security</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 space-y-1 text-xs">
            <div className="text-neutral-700">
              Authenticated as: <span className="font-semibold">{currentUser.email}</span>
            </div>
            <div className="text-neutral-500">
              Org Role: <span className="font-medium text-neutral-800 capitalize">{currentUser.orgRole}</span> | Brand Role:{" "}
              <span className="font-medium text-neutral-800 capitalize">{currentUser.brandRole}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
