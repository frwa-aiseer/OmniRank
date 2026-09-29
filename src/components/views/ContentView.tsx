/**
 * OR-P05-FINAL — Content View (Article List + Editor Integration)
 *
 * Live mode: uses authenticated /api/articles endpoints with Supabase session bearer token.
 * Demo mode: uses in-memory behavior explicitly in client state.
 * Never imports or executes server ArticleRepository in the browser.
 */

import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  Plus,
  CheckCircle,
  Clock,
  Eye,
  Trash2,
  X,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { useApp } from "../../context/AppContext.tsx";
import { supabase } from "../../lib/supabase/client.ts";
import { ArticleEditorView } from "./ArticleEditorView.tsx";
import {
  ArticleEnvelope,
  ArticleVersion,
  ARTICLE_SCHEMA_VERSION,
  Article,
  ArticleStatus,
} from "../../types/article.ts";

// ============================================================================
// Demo In-Memory Store (client-only, used only when isLiveSupabase === false)
// ============================================================================

const demoArticlesStore = new Map<string, Article[]>(); // brandId -> articles
const demoWorkingDocsStore = new Map<string, ArticleEnvelope>(); // articleId -> workingDoc
const demoVersionsStore = new Map<string, ArticleVersion[]>(); // articleId -> versions

// ============================================================================
// Live API Client
// ============================================================================

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ============================================================================
// ContentView
// ============================================================================

export function ContentView() {
  const { currentBrand, currentUser, isLiveSupabase } = useApp();

  // ---- List state ----
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingList, setLoadingList] = useState(false);

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
  const orgId =
    (currentBrand as unknown as Record<string, string>)?.organizationId ??
    "11111111-1111-4000-8000-111111111111";
  const userId =
    (currentUser as unknown as Record<string, string>)?.id ??
    "00000000-0000-4000-8000-000000000001";

  // ---- API Operations (Live vs Demo) ----

  const apiListArticles = useCallback(async (bId: string): Promise<Article[]> => {
    if (!bId) return [];
    if (isLiveSupabase) {
      const res = await fetch(`/api/articles/${bId}`, { headers: await getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to list articles (${res.status})`);
      const data = await res.json();
      return data.articles ?? [];
    }
    return demoArticlesStore.get(bId) ?? [];
  }, [isLiveSupabase]);

  const apiCreateArticle = useCallback(
    async (params: { title: string; slug: string }): Promise<Article> => {
      if (isLiveSupabase) {
        const res = await fetch(`/api/articles/${brandId}`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            organizationId: orgId,
            title: params.title,
            slug: params.slug,
            locale: "en",
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to create article (${res.status})`);
        }
        const data = await res.json();
        return data.article;
      }

      // Demo mode
      const now = new Date().toISOString();
      const newArt: Article = {
        id: crypto.randomUUID(),
        organizationId: orgId,
        brandId,
        schemaVersion: ARTICLE_SCHEMA_VERSION,
        status: "drafting" as ArticleStatus,
        title: params.title,
        slug: params.slug,
        locale: "en",
        seo: {},
        geo: {},
        metadata: {},
        sources: [],
        relationships: [],
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      };
      const currentList = demoArticlesStore.get(brandId) ?? [];
      demoArticlesStore.set(brandId, [newArt, ...currentList]);
      return newArt;
    },
    [isLiveSupabase, brandId, orgId, userId]
  );

  const apiGetWorkingDocument = useCallback(
    async (artId: string, bId: string): Promise<ArticleEnvelope | null> => {
      if (isLiveSupabase) {
        const res = await fetch(`/api/articles/${bId}/${artId}/working-document`, {
          headers: await getAuthHeaders(),
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Failed to fetch working document (${res.status})`);
        const data = await res.json();
        return data.workingDocument?.content ?? null;
      }
      return demoWorkingDocsStore.get(artId) ?? null;
    },
    [isLiveSupabase]
  );

  const apiAutosave = useCallback(
    async (content: ArticleEnvelope): Promise<void> => {
      if (!editingArticle) return;
      if (isLiveSupabase) {
        const res = await fetch(
          `/api/articles/${editingArticle.brandId}/${editingArticle.id}/autosave`,
          {
            method: "PUT",
            headers: await getAuthHeaders(),
            body: JSON.stringify({ content, organizationId: editingArticle.organizationId }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Autosave failed (${res.status})`);
        }
        return;
      }
      demoWorkingDocsStore.set(editingArticle.id, content);
    },
    [isLiveSupabase, editingArticle]
  );

  const apiCreateVersion = useCallback(
    async (content: ArticleEnvelope, label: string): Promise<ArticleVersion> => {
      if (!editingArticle) throw new Error("No article open");
      if (isLiveSupabase) {
        const res = await fetch(
          `/api/articles/${editingArticle.brandId}/${editingArticle.id}/versions`,
          {
            method: "POST",
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              content,
              label,
              organizationId: editingArticle.organizationId,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Version creation failed (${res.status})`);
        }
        const data = await res.json();
        return data.version;
      }

      // Demo mode
      const currentVers = demoVersionsStore.get(editingArticle.id) ?? [];
      const newVer: ArticleVersion = {
        id: crypto.randomUUID(),
        articleId: editingArticle.id,
        brandId: editingArticle.brandId,
        organizationId: editingArticle.organizationId,
        versionNumber: currentVers.length + 1,
        label,
        content,
        schemaVersion: content.schemaVersion,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      };
      demoVersionsStore.set(editingArticle.id, [newVer, ...currentVers]);
      return newVer;
    },
    [isLiveSupabase, editingArticle, userId]
  );

  const apiListVersions = useCallback(
    async (artId: string, bId: string): Promise<ArticleVersion[]> => {
      if (isLiveSupabase) {
        const res = await fetch(`/api/articles/${bId}/${artId}/versions`, {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.versions ?? [];
      }
      return demoVersionsStore.get(artId) ?? [];
    },
    [isLiveSupabase]
  );

  const apiRestoreVersion = useCallback(
    async (versionId: string): Promise<ArticleEnvelope> => {
      if (!editingArticle) throw new Error("No article open");
      if (isLiveSupabase) {
        const res = await fetch(
          `/api/articles/${editingArticle.brandId}/${editingArticle.id}/versions/${versionId}/restore`,
          {
            method: "POST",
            headers: await getAuthHeaders(),
            body: JSON.stringify({ organizationId: editingArticle.organizationId }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Failed to restore version (${res.status})`);
        }
        const data = await res.json();
        const restoredEnvelope = data.workingDocument?.content as ArticleEnvelope;
        setEditingWorkingDoc(restoredEnvelope);
        return restoredEnvelope;
      }

      // Demo mode
      const versions = demoVersionsStore.get(editingArticle.id) ?? [];
      const ver = versions.find((v) => v.id === versionId);
      if (!ver) throw new Error("Version not found in demo store");
      demoWorkingDocsStore.set(editingArticle.id, ver.content);
      setEditingWorkingDoc(ver.content);
      return ver.content;
    },
    [isLiveSupabase, editingArticle]
  );

  // ---- Load articles list ----
  const loadArticles = useCallback(async () => {
    if (!brandId) return;
    setLoadingList(true);
    try {
      const list = await apiListArticles(brandId);
      setArticles(list);
    } catch {
      // non-fatal
    } finally {
      setLoadingList(false);
    }
  }, [brandId, apiListArticles]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // ---- Open editor ----
  const openEditor = useCallback(
    async (article: Article) => {
      setEditorLoading(true);
      setEditingArticle(article);
      try {
        const workingDoc = await apiGetWorkingDocument(article.id, article.brandId);
        setEditingWorkingDoc(workingDoc ?? undefined);
        const versionList = await apiListVersions(article.id, article.brandId);
        setEditingVersions(versionList);
      } finally {
        setEditorLoading(false);
      }
    },
    [apiGetWorkingDocument, apiListVersions]
  );

  // ---- Create article form handler ----
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!brandId || !orgId) {
      setFormError("No brand/org selected.");
      return;
    }

    try {
      const slug = newSlug.trim() || newTitle.trim().toLowerCase().replace(/\s+/g, "-");
      const article = await apiCreateArticle({ title: newTitle.trim(), slug });
      setArticles((prev) => [article, ...prev]);
      setNewTitle("");
      setNewSlug("");
      setFormError("");
      setIsCreateModalOpen(false);
      openEditor(article);
    } catch (err: unknown) {
      setFormError((err as Error).message || "Failed to create article");
    }
  };

  // ---- Save version handler for editor ----
  const handleSaveVersion = useCallback(
    async (content: ArticleEnvelope, label: string): Promise<ArticleVersion> => {
      const ver = await apiCreateVersion(content, label);
      setEditingVersions((prev) => [ver, ...prev]);
      return ver;
    },
    [apiCreateVersion]
  );

  // ---- Delete article handler ----
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
            onClick={() => {
              setEditingArticle(null);
              loadArticles();
            }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to articles
          </button>
          <span className="text-neutral-300">|</span>
          <span className="text-xs text-neutral-500 truncate">{editingArticle.title}</span>
          <span
            className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded border ${
              editingArticle.status === "drafting"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : editingArticle.status === "approved"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}
          >
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
              onAutosave={apiAutosave}
              onSaveVersion={handleSaveVersion}
              onRestoreVersion={apiRestoreVersion}
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
          onClick={() => {
            setFormError("");
            setIsCreateModalOpen(true);
          }}
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
              <span className="font-medium text-neutral-700">
                {currentBrand?.name || "your brand"}
              </span>.
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
            Create First Article
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((article) => {
            const isDraft =
              article.status === "drafting" ||
              article.status === "brief" ||
              article.status === "researching";
            const isApproved =
              article.status === "approved" || article.status === "published";
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
                        : isApproved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
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

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-neutral-700">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug)
                      setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
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
