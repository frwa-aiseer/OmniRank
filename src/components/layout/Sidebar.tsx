import { 
  Home, 
  Lightbulb, 
  FileText, 
  Calendar, 
  TrendingUp, 
  Brain, 
  Settings, 
  Layers
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { AppView } from "../../types/index.ts";
import { cn } from "../../lib/utils.ts";

interface NavItem {
  id: AppView;
  label: string;
  question: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    question: "What should I do today?",
    icon: Home,
  },
  {
    id: "opportunities",
    label: "Opportunities",
    question: "What should we work on next?",
    icon: Lightbulb,
  },
  {
    id: "content",
    label: "Content",
    question: "What are we creating?",
    icon: FileText,
  },
  {
    id: "calendar",
    label: "Calendar",
    question: "When is it going live?",
    icon: Calendar,
  },
  {
    id: "growth",
    label: "Growth",
    question: "What is working?",
    icon: TrendingUp,
  },
  {
    id: "brand-brain",
    label: "Brand Brain",
    question: "What does OmniRank know about us?",
    icon: Brain,
  },
];

export function Sidebar() {
  const { currentView, setCurrentView, currentBrand } = useApp();

  return (
    <aside
      id="omnirank-sidebar"
      className="w-64 bg-neutral-900 text-neutral-100 flex flex-col justify-between border-r border-neutral-800 shrink-0 select-none"
    >
      <div className="p-4 space-y-6">
        {/* Brand/App Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-white leading-tight">OmniRank</h1>
            <p className="text-[11px] text-neutral-400 truncate max-w-[140px]">{currentBrand.name}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left group cursor-pointer",
                  isActive
                    ? "bg-neutral-800 text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? "text-indigo-400" : "text-neutral-400 group-hover:text-neutral-200")} />
                <div className="flex-1 truncate">
                  <div className="leading-none">{item.label}</div>
                  <div className="text-[10px] text-neutral-500 font-normal truncate mt-0.5 group-hover:text-neutral-400">
                    {item.question}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Settings */}
      <div className="p-4 border-t border-neutral-800 space-y-2">
        <button
          id="nav-settings"
          onClick={() => setCurrentView("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer",
            currentView === "settings"
              ? "bg-neutral-800 text-white"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span>Settings & Tenancy</span>
        </button>
      </div>
    </aside>
  );
}
