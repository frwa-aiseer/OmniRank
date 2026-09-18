import { useState } from "react";
import { TrendingUp, ArrowUpRight, Search, BarChart3, Activity, Globe, Link2, CheckCircle2, RefreshCw, Unlink, AlertCircle } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function GrowthView() {
  const { currentBrand, currentWebsite, growthMetrics, connectSearchConsole, disconnectSearchConsole } = useApp();

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [propertyUrl, setPropertyUrl] = useState(currentWebsite?.domain || currentBrand?.primaryDomain || "");
  const [isSyncing, setIsSyncing] = useState(false);

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyUrl) return;
    connectSearchConsole(propertyUrl.trim());
    setIsConnectModalOpen(false);
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  return (
    <div id="growth-view" className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <TrendingUp className="w-4 h-4" />
            <span>Growth Brain</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What is working?</h1>
          <p className="text-sm text-neutral-500">
            Search performance, query impressions, click-through rates, and synchronized Google Search Console / GA4 metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {growthMetrics.isConnected ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-indigo-600" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
              </button>
              <button
                onClick={disconnectSearchConsole}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPropertyUrl(currentWebsite?.domain || currentBrand?.primaryDomain || "");
                setIsConnectModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Connect Search Console</span>
            </button>
          )}
        </div>
      </div>

      {/* Connection Status Banner */}
      {!growthMetrics.isConnected && (
        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Search Data Source Not Connected</span>
          </div>
          <p className="text-amber-700 leading-relaxed max-w-2xl">
            To view live organic impressions, click counts, CTR uplift, and keyword ranking shifts for{" "}
            <span className="font-semibold">{currentBrand?.name || "your brand"}</span>, link your Google Search Console property or domain sitemap.
          </p>
        </div>
      )}

      {/* Live Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Total Impressions (30d)</span>
            <Search className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            {growthMetrics.isConnected ? growthMetrics.impressions.toLocaleString() : "0"}
          </div>
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-0.5">
            {growthMetrics.isConnected ? (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{growthMetrics.impressionsDeltaPct}% vs previous 30d</span>
              </span>
            ) : (
              <span>Connect Search Console to stream</span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Organic Clicks (30d)</span>
            <BarChart3 className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            {growthMetrics.isConnected ? growthMetrics.clicks.toLocaleString() : "0"}
          </div>
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-0.5">
            {growthMetrics.isConnected ? (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{growthMetrics.clicksDeltaPct}% vs previous 30d</span>
              </span>
            ) : (
              <span>Connect Search Console to stream</span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-1">
          <div className="text-xs text-neutral-500 flex items-center justify-between">
            <span>Average CTR</span>
            <Activity className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">
            {growthMetrics.isConnected ? `${growthMetrics.avgCtr}%` : "0.0%"}
          </div>
          <div className="text-xs text-neutral-400 font-medium flex items-center gap-0.5">
            {growthMetrics.isConnected ? (
              <span className="text-emerald-600 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{growthMetrics.ctrDeltaPct}% CTR uplift</span>
              </span>
            ) : (
              <span>Connect Search Console to stream</span>
            )}
          </div>
        </div>
      </div>

      {/* Connected Source Details */}
      {growthMetrics.isConnected && (
        <div className="p-6 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-neutral-800">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Active Search Property: {growthMetrics.connectedProperty}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>GSC Live Sync Active</span>
            </span>
          </div>
          <p className="text-neutral-500">
            Last synced: {growthMetrics.lastSyncedAt ? new Date(growthMetrics.lastSyncedAt).toLocaleString() : "Just now"} • Auto-refresh interval: 6 hours
          </p>
        </div>
      )}

      {/* Connect GSC Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-neutral-200 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">Connect Google Search Console</h3>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-neutral-500">
              Enter your Google Search Console property URL or domain prefix for <span className="font-semibold text-neutral-800">{currentBrand?.name || "your brand"}</span>.
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Property Domain / URL *</label>
                <input
                  type="text"
                  value={propertyUrl}
                  onChange={(e) => setPropertyUrl(e.target.value)}
                  placeholder="e.g. sc-domain:mybrand.com or https://mybrand.com"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition cursor-pointer"
                >
                  Connect Property
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
