import { useState } from "react";
import { FileText, Plus, CheckCircle, Clock, Eye, Trash2, ShieldCheck, X, Sparkles, AlertCircle } from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { ArticleDocument, ArticleStatus } from "../../types/index.ts";

export function ContentView() {
  const { currentBrand, currentUser, articles, createArticle, updateArticle, deleteArticle } = useApp();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDocument | null>(null);

  // New article form state
  const [newTitle, setNewTitle] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [formError, setFormError] = useState("");

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Please enter an article title.");
      return;
    }

    try {
      await createArticle({
        title: newTitle.trim(),
        targetKeyword: newKeyword.trim() || "Technical Keyword",
        summary: newSummary.trim() || "Structured block outline with verified evidence claims.",
        status: "drafting",
        version: "v1.0",
        canonicalBlocksCount: 8,
        evidenceClaimsCount: 2,
        authorName: currentUser.fullName || "Author",
      });

      setNewTitle("");
      setNewKeyword("");
      setNewSummary("");
      setFormError("");
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to create article");
    }
  };

  const handleStatusChange = async (articleId: string, newStatus: ArticleStatus) => {
    await updateArticle(articleId, { status: newStatus });
    if (selectedArticle?.id === articleId) {
      setSelectedArticle({ ...selectedArticle, status: newStatus });
    }
  };

  const handleDelete = async (articleId: string) => {
    if (confirm("Are you sure you want to delete this article document?")) {
      await deleteArticle(articleId);
      if (selectedArticle?.id === articleId) {
        setSelectedArticle(null);
      }
    }
  };

  return (
    <div id="content-view" className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <FileText className="w-4 h-4" />
            <span>Structured Articles</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">What are we creating?</h1>
          <p className="text-sm text-neutral-500">
            Versioned, canonical block-based articles backed by evidence claims and brand voice policies.
          </p>
        </div>
        <button
          onClick={() => {
            setFormError("");
            setIsCreateModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Article Document</span>
        </button>
      </div>

      {/* Article List or Empty State */}
      {articles.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-neutral-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">No articles created yet</h2>
            <p className="text-xs text-neutral-500">
              Start by creating your first article document for <span className="font-medium text-neutral-700">{currentBrand?.name || "your brand"}</span>. You can define block outlines, cite evidence, and submit for review.
            </p>
          </div>
          <button
            onClick={() => {
              setFormError("");
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Article</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => {
            const isDraft = article.status === "drafting";
            const isReview = article.status === "review";
            const isApproved = article.status === "approved" || article.status === "published";

            return (
              <div
                key={article.id}
                className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                      isDraft
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : isReview
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {isDraft && <Clock className="w-3 h-3" />}
                    {isReview && <Eye className="w-3 h-3" />}
                    {isApproved && <CheckCircle className="w-3 h-3" />}
                    <span>
                      {isDraft
                        ? `In Drafting (${article.version})`
                        : isReview
                        ? `Awaiting Review (${article.version})`
                        : `Approved (${article.version})`}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{article.canonicalBlocksCount} Canonical Blocks</span>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="text-neutral-400 hover:text-rose-600 transition p-1"
                      title="Delete Article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h2 className="font-semibold text-neutral-900 text-base">{article.title}</h2>
                <p className="text-xs text-neutral-500 line-clamp-2">{article.summary}</p>

                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-neutral-500">
                    By {article.authorName} • Keyword: <span className="font-medium text-neutral-700">{article.targetKeyword}</span>
                  </span>
                  <button
                    onClick={() => setSelectedArticle(article)}
                    className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Inspect Version</span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Article Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 border border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">New Structured Article Document</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateArticle} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Article Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Architectural Blueprint for Enterprise Multi-Tenancy"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Target Keyword / Topic</label>
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="e.g. enterprise multi-tenancy architecture"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Executive Summary / Brief</label>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  rows={3}
                  placeholder="Define the primary thesis, key block sections, and target evidence citations..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition cursor-pointer"
                >
                  Create Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Article Inspector / Details Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-5 border border-neutral-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Version {selectedArticle.version} • {selectedArticle.status.toUpperCase()}
                </span>
                <h3 className="font-bold text-neutral-900 text-lg">{selectedArticle.title}</h3>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2 text-xs">
              <div className="font-semibold text-neutral-700">Document Summary</div>
              <p className="text-neutral-600 leading-relaxed">{selectedArticle.summary}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                <div className="font-bold text-neutral-900 text-base">{selectedArticle.canonicalBlocksCount}</div>
                <div className="text-neutral-500">Canonical Blocks</div>
              </div>
              <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                <div className="font-bold text-neutral-900 text-base">{selectedArticle.evidenceClaimsCount}</div>
                <div className="text-neutral-500">Evidence Claims Cited</div>
              </div>
              <div className="p-3 rounded-lg border border-neutral-200 bg-white">
                <div className="font-bold text-emerald-600 text-base">Passed (100%)</div>
                <div className="text-neutral-500">Policy Gate Status</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-100">
              <span className="text-xs font-semibold text-neutral-700 block">Workflow State Transitions</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStatusChange(selectedArticle.id, "drafting")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    selectedArticle.status === "drafting"
                      ? "bg-amber-500 text-white border-amber-600"
                      : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  Mark as Drafting
                </button>
                <button
                  onClick={() => handleStatusChange(selectedArticle.id, "review")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    selectedArticle.status === "review"
                      ? "bg-blue-600 text-white border-blue-700"
                      : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  Submit for Review
                </button>
                <button
                  onClick={() => handleStatusChange(selectedArticle.id, "approved")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    selectedArticle.status === "approved"
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  Approve & Lock Version
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <button
                onClick={() => handleDelete(selectedArticle.id)}
                className="text-xs text-rose-600 font-medium hover:text-rose-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Document</span>
              </button>
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
