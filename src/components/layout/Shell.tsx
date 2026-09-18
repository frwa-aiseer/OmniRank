import { useApp } from "../../context/AppContext.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { Header } from "./Header.tsx";
import { HomeView } from "../views/HomeView.tsx";
import { OpportunitiesView } from "../views/OpportunitiesView.tsx";
import { ContentView } from "../views/ContentView.tsx";
import { CalendarView } from "../views/CalendarView.tsx";
import { GrowthView } from "../views/GrowthView.tsx";
import { BrandBrainView } from "../views/BrandBrainView.tsx";
import { SettingsView } from "../views/SettingsView.tsx";
import { AuthView } from "../views/AuthView.tsx";

export function Shell() {
  const { currentView, setCurrentView, loadDemoWorkspace } = useApp();

  if (currentView === "auth") {
    return (
      <AuthView
        onSuccess={() => setCurrentView("home")}
        onExploreDemo={() => loadDemoWorkspace()}
      />
    );
  }

  const renderView = () => {
    switch (currentView) {
      case "home":
        return <HomeView />;
      case "opportunities":
        return <OpportunitiesView />;
      case "content":
        return <ContentView />;
      case "calendar":
        return <CalendarView />;
      case "growth":
        return <GrowthView />;
      case "brand-brain":
        return <BrandBrainView />;
      case "settings":
        return <SettingsView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div id="omnirank-root" className="flex h-screen w-screen overflow-hidden bg-neutral-100 font-sans antialiased text-neutral-900">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-neutral-50/50">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
