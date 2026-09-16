import { ShieldCheck, User, Building, Sparkles } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function Header() {
  const { currentOrg, currentBrand, currentUser } = useApp();

  return (
    <header
      id="omnirank-header"
      className="h-14 bg-white border-b border-neutral-200 px-6 flex items-center justify-between shrink-0"
    >
      {/* Left: Active Organization & Brand Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-neutral-600">
        <div className="flex items-center gap-1.5 font-medium text-neutral-800">
          <Building className="w-3.5 h-3.5 text-neutral-500" />
          <span id="header-org-name">{currentOrg.name}</span>
        </div>
        <span className="text-neutral-300">/</span>
        <div className="flex items-center gap-1.5 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          <span id="header-brand-name">{currentBrand.name}</span>
        </div>
      </div>

      {/* Right: User Role & Tenant Isolation Badge */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">RLS Protected</span>
        </div>

        <div className="flex items-center gap-2 pl-3 border-l border-neutral-200 text-xs">
          <div className="w-7 h-7 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center text-neutral-700 font-semibold">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-left hidden md:block">
            <div className="font-medium text-neutral-800 leading-tight">{currentUser.fullName}</div>
            <div className="text-[10px] text-neutral-500 capitalize">
              {currentUser.orgRole} · {currentUser.brandRole}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
