import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Globe, CheckCircle2, Plus, Clock, X, Trash2, CalendarDays } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";

export function CalendarView() {
  const { currentBrand, currentWebsite, articles, updateArticle } = useApp();

  const [currentMonthName, setCurrentMonthName] = useState("September 2026");
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [targetCms, setTargetCms] = useState("WordPress");

  const scheduledArticles = articles.filter((a) => a.scheduledDate);

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticleId || !scheduledDate) return;

    await updateArticle(selectedArticleId, {
      scheduledDate,
      targetCms: targetCms || "WordPress",
    });

    setIsScheduleModalOpen(false);
    setSelectedArticleId("");
    setScheduledDate("");
  };

  const handleUnschedule = async (articleId: string) => {
    await updateArticle(articleId, {
      scheduledDate: undefined,
      targetCms: undefined,
    });
  };

  return (
    <div id="calendar-view" className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <CalendarIcon className="w-4 h-4" />
            <span>Editorial Schedule</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">When is it going live?</h1>
          <p className="text-sm text-neutral-500">
            Publishing calendar mapped to target CMS destinations and distribution workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-lg p-1">
            <button className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-neutral-800 px-2">{currentMonthName}</span>
            <button className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600 cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {articles.length > 0 && (
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Article</span>
            </button>
          )}
        </div>
      </div>

      {/* Scheduled Releases List or Empty State */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Scheduled Releases</h2>
          <span className="text-xs text-neutral-400">{scheduledArticles.length} items queued</span>
        </div>

        {scheduledArticles.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-semibold text-neutral-800">No scheduled releases</h3>
              <p className="text-xs text-neutral-500">
                {articles.length === 0
                  ? "Create articles in the Content tab to schedule them for publishing."
                  : "Assign publishing dates and CMS destinations to your approved articles to view them here."}
              </p>
            </div>
            {articles.length > 0 && (
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule an Article</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledArticles.map((article) => {
              const dateObj = new Date(article.scheduledDate || "");
              const monthStr = isNaN(dateObj.getTime()) ? "SEP" : dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
              const dayStr = isNaN(dateObj.getTime()) ? "18" : dateObj.getDate().toString();

              return (
                <div
                  key={article.id}
                  className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-indigo-100 text-indigo-700 flex flex-col items-center justify-center font-bold text-xs leading-none shrink-0">
                      <span>{monthStr}</span>
                      <span className="text-sm">{dayStr}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-neutral-900">{article.title}</h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mt-0.5">
                        <Globe className="w-3.5 h-3.5 text-neutral-400" />
                        <span>
                          {article.targetCms || "WordPress"} ({currentWebsite?.domain || currentBrand?.primaryDomain || "brand.com"})
                        </span>
                        <span>•</span>
                        <span>Date: {article.scheduledDate}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-medium px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{article.status === "approved" ? "Approved Version Locked" : "Scheduled Draft"}</span>
                    </span>
                    <button
                      onClick={() => handleUnschedule(article.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition"
                      title="Unschedule"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-neutral-200 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">Schedule Publishing</h3>
              </div>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Select Article Document *</label>
                <select
                  value={selectedArticleId}
                  onChange={(e) => setSelectedArticleId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">-- Select an article --</option>
                  {articles.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.title} ({art.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target Publication Date *</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target CMS Destination</label>
                <select
                  value={targetCms}
                  onChange={(e) => setTargetCms(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="WordPress">WordPress (REST API / Application Password)</option>
                  <option value="Webflow">Webflow (CMS API)</option>
                  <option value="Ghost">Ghost (Admin API)</option>
                  <option value="Custom Webhook">Custom Ingestion Webhook</option>
                </select>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition cursor-pointer"
                >
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
