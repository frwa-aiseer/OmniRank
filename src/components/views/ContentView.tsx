/**
 * OR-P05-FIX — Content View (Article List + Editor Integration)
 *
 * Live mode: uses /api/articles backend (Supabase-scoped RLS).
 * Demo mode: uses in-memory article repository.
 *
 * When an article is opened, renders ArticleEditorView in-place.
 * ArticleDocument state (from AppContext) is left for demo/legacy list display;
 * actual article content is managed by the article API / InMemoryArticleRepository.
 */

import { useState, useCallback } from "react";
import {
  FileText, Plus, CheckCircle, Clock, Eye, Trash2, X, AlertCircle, ArrowLeft
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { ArticleEditorView } from "./ArticleEditorView.tsx";
import { getArticleRepository } from "../../server/article/repository.ts";
import { ArticleEnvelope, ArticleVersion, ARTICLE_SCHEMA_VERSION, Article, ArticleStatus } from "../../types/article.ts";

// ============================================================================
// Helper — derive repo access token from AppContext
// ============================================================================
function useArticleRepo() {
  const { currentUser } = useApp();
  // In live mode the access token would come from Supabase session.
  // Here we pass undefined so demo InMemoryRepo is used (isLiveSupabaseConfigured() = false in dev).
  return getArticleRepository(undefined);
}

// ============================================================================
// ContentView
// ============================================================================
export function ContentView() {
  const { currentBrand, currentUser } = useApp();
  const repo = useArticleRepo();

  // ---- List state ----
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listLoaded, setListLoaded] = useState(false);

  // ---- Create state ----
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [formError, setFormError] = useState("");

  // ---- Editor state ----
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editingWorkingDoc, setEditingWorkingDoc] = useState<ArticleEnvelope | undefined>(undefined);
  const [editingVersions, setEditingVersions] = useState<ArticleVersion[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);

  const brandId = currentBrand?.id ?? "";
  // Derive orgId from current brand; fallback to a stable demo UUID
  const orgId = (currentBrand as unknown as Record<string, string>)?.organizationId
    ?? "11111111-1111-4000-8000-111111111111";
  const userId = (currentUser as unknown as Record<string, string>)?.id
    ?? "00000000-0000-4000-8000-000000000001";

  // Load articles when brand changes
  const loadArticles = useCallback(async () => {
    if (!brandId) return;
    setLoadingList(true);
    try {
      const list = await repo.listArticles(brandId);
      setArticles(list);
      setListLoaded(true);
    } finally {
      setLoadingList(false);
    }
  }, [brandId, repo]);

  // Trigger load on first render if brand is available
  if (brandId && !listLoaded && !loadingList) {
    loadArticles();
  }

  // ---- Create article ----
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) { setFormError("Title is required."); return; }
    if (!brandId || !orgId) { setFormError("No brand/org selected."); return; }

    try {
      const article = await repo.createArticle({
        organizationId: orgId,
        brandId,
        schemaVersion: ARTICLE_SCHEMA_VERSION,
        status: "drafting" as ArticleStatus,
        title: newTitle.trim(),
        slug: newSlug.trim() || newTitle.trim().toLowerCase().replace(/\s+/g, "-"),
        locale: "en",
        seo: {},
        geo: {},
        metadata: {},
        sources: [],
        relationships: [],
        createdBy: userId,
      });
      setArticles((prev) => [article, ...prev]);
      setNewTitle(""); setNewSlug(""); setFormError("");
      setIsCreateModalOpen(false);
      // Open editor immediately
      openEditor(article);
    } catch (err: unknown) {
      setFormError((err as Error).message || "Failed to create article");
    }
  };

  // ---- Open editor ----
  const openEditor = useCallback(async (article: Article) => {
    setEditorLoading(true);
    setEditingArticle(article);
    try {
      const workingDoc = await repo.getWorkingDocument(article.id, article.brandId);
      setEditingWorkingDoc(workingDoc?.content);
      const versionList = await repo.listVersions(article.id, article.brandId);
      setEditingVersions(versionList);
    } finally {
      setEditorLoading(false);
    }
  }, [repo]);

  // ---- Autosave ----
  const handleAutosave = useCallback(async (content: ArticleEnvelope) => {
    if (!editingArticle) return;
    await repo.autosaveWorkingDocument(
      editingArticle.id, editingArticle.brandId, editingArticle.organizationId,
      content, userId
    );
  }, [editingArticle, repo, userId]);

  // ---- Save version ----
  const handleSaveVersion = useCallback(async (content: ArticleEnvelope, label: string): Promise<ArticleVersion> => {
    if (!editingArticle) throw new Error("No article open");
    const version = await repo.createVersion(
      editingArticle.id, editingArticle.brandId, editingArticle.organizationId,
      content, label, userId
    );
    setEditingVersions((prev) => [version, ...prev]);
    return version;
  }, [editingArticle, repo, userId]);

  // ---- Restore version ----
  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!editingArticle) return;
    const restored = await repo.restoreVersion(
      editingArticle.id, editingArticle.brandId, editingArticle.organizationId,
      versionId, userId
    );
    setEditingWorkingDoc(restored.content);
  }, [editingArticle, repo, userId]);

  // ---- Delete ----
  const handleDelete = async (articleId: string) => {
    if (!confirm("Delete this article?")) return;
    setArticles((prev) => prev.filter((a) => a.id !== articleId));
    if (editingArticle?.id === articleId) setEditingArticle(null);
  };

  // ============================================================
  // EDITOR MODE
  // ============================================================
  if (editingArticle) {
    return (
      <div className="h-full flex flex-col">
        {/* Editor header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
          <button
            onClick={() => { setEditingArticle(null); loadArticles(); }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to articles
          </button>
          <span className="text-neutral-300">|</span>
          <span className="text-xs text-neutral-500 truncate">{editingArticle.title}</span>
          <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded border ${
            editingArticle.status === "drafting"
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : editingArticle.status === "approved"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-blue-50 text-blue-700 border-blue-200"
          }`}>
            {editingArticle.status.toUpperCase()}
          </span>
        </div>

        {editorLoading ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
            Loading editor…
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ArticleEditorView
              articleId={editingArticle.id}
              brandId={editingArticle.brandId}
              organizationId={editingArticle.organizationId}
              userId={userId}
              initialContent={editingWorkingDoc}
              initialVersions={editingVersions}
              onAutosave={handleAutosave}
              onSaveVersion={handleSaveVersion}
              onRestoreVersion={handleRestoreVersion}
            />
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // LIST MODE
  // ============================================================
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
          onClick={() => { setFormError(""); setIsCreateModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Article</span>
        </button>
      </div>

      {/* Article list */}
      {loadingList ? (
        <div className="text-center py-12 text-neutral-400 text-sm">Loading articles…</div>
      ) : articles.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-neutral-200 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-neutral-900">No articles yet</h2>
            <p className="text-xs text-neutral-500">
              Create your first structured article for{" "}
              <span className="font-medium text-neutral-700">{currentBrand?.name || "your brand"}</span>.
            </p>
          </div>
          <button
            onClick={() => { setFormError(""); setIsCreateModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Article
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => {
            const isDraft = article.status === "drafting" || article.status === "brief" || article.status === "researching";
            const isApproved = article.status === "approved" || article.status === "published";
            return (
              <div
                key={article.id}
                className="p-5 rounded-xl bg-white border border-neutral-200 shadow-xs space-y-3 hover:border-neutral-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                    isDraft
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : isApproved
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {isDraft && <Clock className="w-3 h-3" />}
                    {isApproved && <CheckCircle className="w-3 h-3" />}
                    {!isDraft && !isApproved && <Eye className="w-3 h-3" />}
                    {article.status.toUpperCase()}
                  </span>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="text-neutral-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h2 className="font-semibold text-neutral-900 text-base">{article.title}</h2>
                <p className="text-xs text-neutral-500 font-mono">{article.slug}</p>

                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-neutral-500 text-[10px]">
                    {new Date(article.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => openEditor(article)}
                    className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Editor</span>
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 border border-neutral-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-neutral-900 text-base">New Article</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  placeholder="Article title"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Slug</label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="url-friendly-slug"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
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
                  Create & Open Editor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
