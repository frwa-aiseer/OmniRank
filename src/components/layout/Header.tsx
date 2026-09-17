import { useState } from "react";
import { ShieldCheck, User, Building, Sparkles, ChevronDown, Plus, Globe } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function Header() {
  const {
    organizations,
    currentOrg,
    setCurrentOrg,
    brands,
    currentBrand,
    setCurrentBrand,
    websites,
    currentWebsite,
    currentUser,
    setCurrentView,
  } = useApp();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);

  const orgBrands = brands.filter((b) => b.organizationId === currentOrg.id);

  return (
    <header
      id="omnirank-header"
      className="h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shrink-0 relative z-30"
    >
      {/* Left: Active Organization & Brand Switchers */}
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        {/* Organization Switcher */}
        <div className="relative">
          <button
            id="org-switcher-btn"
            onClick={() => {
              setOrgDropdownOpen(!orgDropdownOpen);
              setBrandDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 font-medium text-neutral-800 hover:bg-neutral-100 px-2 py-1 rounded transition"
          >
            <Building className="w-3.5 h-3.5 text-neutral-500" />
            <span id="header-org-name">{currentOrg.name}</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {orgDropdownOpen && (
            <div
              id="org-dropdown-menu"
              className="absolute left-0 mt-1 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs"
            >
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Organizations
              </div>
              {organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrg(org);
                    setOrgDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-neutral-50 ${
                    org.id === currentOrg.id ? "font-semibold text-indigo-600 bg-indigo-50/50" : "text-neutral-700"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {org.id === currentOrg.id && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded">Active</span>}
                </button>
              ))}
              <div className="border-t border-neutral-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setCurrentView("settings");
                    setOrgDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-indigo-600 hover:bg-neutral-50 flex items-center gap-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Organizations</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <span className="text-neutral-300">/</span>

        {/* Brand Switcher */}
        <div className="relative">
          <button
            id="brand-switcher-btn"
            onClick={() => {
              setBrandDropdownOpen(!brandDropdownOpen);
              setOrgDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded border border-indigo-100 transition"
          >
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span id="header-brand-name">{currentBrand.name}</span>
            <ChevronDown className="w-3 h-3 text-indigo-400" />
          </button>

          {brandDropdownOpen && (
            <div
              id="brand-dropdown-menu"
              className="absolute left-0 mt-1 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-50 text-xs"
            >
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                Brands ({currentOrg.name})
              </div>
              {orgBrands.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setCurrentBrand(b);
                    setBrandDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-neutral-50 ${
                    b.id === currentBrand.id ? "font-semibold text-indigo-600 bg-indigo-50/50" : "text-neutral-700"
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {b.id === currentBrand.id && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded">Active</span>}
                </button>
              ))}
              <div className="border-t border-neutral-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setCurrentView("settings");
                    setBrandDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-indigo-600 hover:bg-neutral-50 flex items-center gap-1.5 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Brands</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Website pill if present */}
        {currentWebsite && (
          <>
            <span className="text-neutral-300 hidden sm:inline">/</span>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              <Globe className="w-3 h-3 text-neutral-400" />
              <span>{currentWebsite.domain}</span>
            </div>
          </>
        )}
      </div>

      {/* Right: User Role & Tenant Isolation Badge */}
      <div className="flex items-center gap-4">
        <div
          title="Row Level Security is active. Anonymous & cross-tenant access is blocked at the database engine level."
          className="flex items-center gap-1.5 text-xs text-neutral-500 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-1 rounded"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-medium hidden sm:inline">RLS Protected</span>
        </div>

        <button
          id="user-profile-btn"
          onClick={() => setCurrentView("settings")}
          className="flex items-center gap-2 pl-3 border-l border-neutral-200 text-xs hover:opacity-80 transition text-left"
        >
          <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-semibold">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="hidden md:block">
            <div className="font-medium text-neutral-800 leading-tight">{currentUser.fullName}</div>
            <div className="text-[10px] text-neutral-500 capitalize">
              {currentUser.orgRole} · {currentUser.brandRole}
            </div>
          </div>
        </button>
      </div>
    </header>
  );
}
