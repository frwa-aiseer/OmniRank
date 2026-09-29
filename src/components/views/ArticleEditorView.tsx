/**
 * OR-P05 — Article Editor View
 *
 * Three-column layout:
 *   Left  : Outline / Blocks / Versions panel
 *   Center: Editor area (BlockNote-style; renders from structured JSON, never HTML)
 *   Right : AI / SEO / GEO / Evidence / Brand / Links panel
 *
 * This is a functional shell. HTML is strictly a rendering output;
 * the canonical source of truth is always the structured JSON content.
 */

import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  List,
  History,
  Cpu,
  Search,
  Globe,
  Shield,
  Tag,
  Link2,
  Save,
  PlusCircle,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  AlignLeft,
  Hash,
  Type,
  Image,
  Quote,
  BarChart2,
  Minus,
  Code,
  Table,
} from "lucide-react";
import { cn } from "../../lib/utils.ts";
import {
  ArticleEnvelope,
  ArticleBlock,
  ArticleVersion,
  BlockType,
  ARTICLE_SCHEMA_VERSION,
} from "../../types/article.ts";

// ============================================================================
// Types
// ============================================================================

type LeftPanel = "outline" | "blocks" | "versions";
type RightPanel = "ai" | "seo" | "geo" | "evidence" | "brand" | "links";

const BLOCK_ICONS: Record<string, typeof AlignLeft> = {
  heading: Hash,
  paragraph: AlignLeft,
  bulletList: List,
  numberedList: List,
  table: Table,
  comparisonTable: Table,
  image: Image,
  youtube: Image,
  quote: Quote,
  statistic: BarChart2,
  callout: Type,
  cta: Type,
  faq: Type,
  code: Code,
  citation: FileText,
  divider: Minus,
};

const INSERTABLE_BLOCKS: Array<{ type: BlockType; label: string }> = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "bulletList", label: "Bullet List" },
  { type: "numberedList", label: "Numbered List" },
  { type: "table", label: "Table" },
  { type: "image", label: "Image" },
  { type: "quote", label: "Quote" },
  { type: "statistic", label: "Statistic" },
  { type: "callout", label: "Callout" },
  { type: "cta", label: "CTA" },
  { type: "faq", label: "FAQ" },
  { type: "code", label: "Code" },
  { type: "citation", label: "Citation" },
  { type: "divider", label: "Divider" },
];

// ============================================================================
// Helpers
// ============================================================================

function emptyEnvelope(articleId: string, brandId: string, userId: string): ArticleEnvelope {
  return {
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    articleId,
    brandId,
    locale: "en",
    title: "Untitled Article",
    slug: "",
    document: { blocks: [] },
    metadata: { status: "drafting" },
    seo: {},
    geo: {},
    sources: [],
    relationships: [],
    provenance: {
      createdBy: userId,
      createdAt: new Date().toISOString(),
    },
  };
}

function makeBlock(type: BlockType, userId: string): ArticleBlock {
  return {
    id: crypto.randomUUID(),
    type,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    content: type === "heading" ? { level: 2, text: "" }
      : type === "divider" ? {}
      : { text: "" },
    attributes: {},
    sourceRefs: [],
    evidenceRefs: [],
    provenance: {
      createdBy: userId,
      createdAt: new Date().toISOString(),
    },
  };
}

function getBlockLabel(block: ArticleBlock): string {
  const c = block.content as Record<string, unknown>;
  if (block.type === "heading") return `H${c.level}: ${String(c.text || "").slice(0, 40) || "(empty)"}`;
  if (block.type === "divider") return "─── Divider ───";
  return `${block.type}: ${String(c.text || "").slice(0, 40) || "(empty)"}`;
}

// ============================================================================
// Sub-components
// ============================================================================

function BlockRow({
  block,
  selected,
  onSelect,
}: {
  block: ArticleBlock;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = BLOCK_ICONS[block.type] ?? AlignLeft;
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors cursor-pointer",
        selected
          ? "bg-indigo-100 text-indigo-800 font-medium"
          : "text-neutral-600 hover:bg-neutral-100"
      )}
    >
      <Icon className="w-3 h-3 shrink-0 text-neutral-400" />
      <span className="truncate flex-1">{getBlockLabel(block)}</span>
    </button>
  );
}

function VersionRow({
  version,
  onRestore,
}: {
  version: ArticleVersion;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-100 group">
      <div className="min-w-0">
        <div className="text-xs font-medium text-neutral-700 truncate">
          v{version.versionNumber} {version.label && `— ${version.label}`}
        </div>
        <div className="text-[10px] text-neutral-400">
          {new Date(version.createdAt).toLocaleString()}
        </div>
      </div>
      <button
        onClick={() => onRestore(version.id)}
        className="ml-2 p-1 rounded text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        title="Restore this version"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onAiReplace,
}: {
  block: ArticleBlock;
  onChange: (updated: ArticleBlock) => void;
  onAiReplace: (blockId: string) => void;
}) {
  const c = block.content as Record<string, unknown>;
  const handleTextChange = (text: string) => {
    onChange({ ...block, content: { ...c, text } });
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-white group relative">
      {/* Block type badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">
          {block.type}
        </span>
        <button
          onClick={() => onAiReplace(block.id)}
          className="text-[10px] text-indigo-500 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-1"
          title="Regenerate this block with AI"
        >
          <Cpu className="w-3 h-3" />
          AI
        </button>
      </div>

      {block.type === "heading" ? (
        <input
          type="text"
          value={String(c.text ?? "")}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Heading text…"
          className={cn(
            "w-full bg-transparent font-bold outline-none text-neutral-800 placeholder-neutral-300",
            (c.level as number) === 1
              ? "text-2xl"
              : (c.level as number) === 2
              ? "text-xl"
              : "text-lg"
          )}
        />
      ) : block.type === "divider" ? (
        <div className="border-t border-neutral-300 my-2" />
      ) : (
        <textarea
          value={String(c.text ?? "")}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={`Enter ${block.type} content…`}
          rows={block.type === "paragraph" ? 3 : 2}
          className="w-full bg-transparent text-sm text-neutral-700 placeholder-neutral-300 outline-none resize-none"
        />
      )}

      {/* Provenance hint */}
      {block.provenance?.aiGenerated && (
        <div className="mt-1.5 text-[10px] text-indigo-400 flex items-center gap-1">
          <Cpu className="w-2.5 h-2.5" />
          AI-generated {block.provenance.aiTaskCode && `(${block.provenance.aiTaskCode})`}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Editor View
// ============================================================================

export interface ArticleEditorViewProps {
  /** Article ID — pre-created by the articles API before editor opens */
  articleId: string;
  brandId: string;
  organizationId: string;
  userId: string;
  /** Initial envelope (loaded from working document or new) */
  initialContent?: ArticleEnvelope;
  /** Existing versions (loaded from API) */
  initialVersions?: ArticleVersion[];
  /** Called when autosave should persist to the API */
  onAutosave?: (content: ArticleEnvelope) => Promise<void>;
  /** Called to create an immutable version milestone */
  onSaveVersion?: (content: ArticleEnvelope, label: string) => Promise<ArticleVersion>;
  /** Called to restore a version (loads the version content back into working doc) */
  onRestoreVersion?: (versionId: string) => Promise<void>;
}

export function ArticleEditorView({
  articleId,
  brandId,
  userId,
  initialContent,
  initialVersions = [],
  onAutosave,
  onSaveVersion,
  onRestoreVersion,
}: ArticleEditorViewProps) {
  const [content, setContent] = useState<ArticleEnvelope>(
    initialContent ?? emptyEnvelope(articleId, brandId, userId)
  );
  const [versions, setVersions] = useState<ArticleVersion[]>(initialVersions);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("outline");
  const [rightPanel, setRightPanel] = useState<RightPanel>("seo");
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const [versionLabel, setVersionLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Autosave on content change (debounced via useEffect)
  useEffect(() => {
    if (!onAutosave) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await onAutosave(content);
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [content, onAutosave]);

  const handleBlockChange = useCallback(
    (updatedBlock: ArticleBlock) => {
      setContent((prev) => ({
        ...prev,
        document: {
          blocks: prev.document.blocks.map((b) =>
            b.id === updatedBlock.id ? updatedBlock : b
          ),
        },
      }));
    },
    []
  );

  const handleAddBlock = useCallback(
    (type: BlockType) => {
      const newBlock = makeBlock(type, userId);
      setContent((prev) => ({
        ...prev,
        document: { blocks: [...prev.document.blocks, newBlock] },
      }));
      setSelectedBlockId(newBlock.id);
    },
    [userId]
  );

  const handleDeleteBlock = useCallback((blockId: string) => {
    setContent((prev) => ({
      ...prev,
      document: {
        blocks: prev.document.blocks.filter((b) => b.id !== blockId),
      },
    }));
    setSelectedBlockId(null);
  }, []);

  const handleAiReplace = useCallback(
    (_blockId: string) => {
      // Architecture stub: AI operation placeholder
      // Full OmniRouter generation is NOT implemented (OR-P05 scope).
      setStatusMessage("AI block regeneration is queued (OmniRouter integration pending in OR-P06).");
      setTimeout(() => setStatusMessage(null), 4000);
    },
    []
  );

  const handleSaveVersion = async () => {
    if (!onSaveVersion) return;
    const label = versionLabel.trim() || `Milestone ${versions.length + 1}`;
    const version = await onSaveVersion(content, label);
    setVersions((prev) => [version, ...prev]);
    setVersionLabel("");
    setStatusMessage(`Version ${version.versionNumber} saved.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!onRestoreVersion) return;
    await onRestoreVersion(versionId);
    setStatusMessage("Version restored to working document.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // ---- Left panel tabs ----
  const leftTabs: Array<{ id: LeftPanel; label: string; icon: typeof FileText }> = [
    { id: "outline", label: "Outline", icon: FileText },
    { id: "blocks", label: "Blocks", icon: List },
    { id: "versions", label: "Versions", icon: History },
  ];

  // ---- Right panel tabs ----
  const rightTabs: Array<{ id: RightPanel; label: string; icon: typeof Cpu }> = [
    { id: "ai", label: "AI", icon: Cpu },
    { id: "seo", label: "SEO", icon: Search },
    { id: "geo", label: "GEO", icon: Globe },
    { id: "evidence", label: "Evidence", icon: Shield },
    { id: "brand", label: "Brand", icon: Tag },
    { id: "links", label: "Links", icon: Link2 },
  ];

  return (
    <div className="flex h-full overflow-hidden bg-neutral-50" data-testid="article-editor">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT PANEL                                                           */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          "flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 shrink-0",
          leftExpanded ? "w-56" : "w-10"
        )}
      >
        {/* Toggle */}
        <button
          onClick={() => setLeftExpanded((p) => !p)}
          className="p-2 flex items-center justify-end text-neutral-400 hover:text-neutral-700 cursor-pointer"
        >
          {leftExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {leftExpanded && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-neutral-100">
              {leftTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setLeftPanel(tab.id)}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors cursor-pointer",
                      leftPanel === tab.id
                        ? "text-indigo-600 border-b-2 border-indigo-600"
                        : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {leftPanel === "outline" && (
                <>
                  {content.document.blocks.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 px-1">No blocks yet.</p>
                  ) : (
                    content.document.blocks.map((block) => (
                      <BlockRow
                        key={block.id}
                        block={block}
                        selected={selectedBlockId === block.id}
                        onSelect={() => setSelectedBlockId(block.id)}
                      />
                    ))
                  )}
                </>
              )}

              {leftPanel === "blocks" && (
                <div className="space-y-1">
                  <p className="text-[10px] text-neutral-400 font-medium px-1 mb-1.5">Insert block</p>
                  {INSERTABLE_BLOCKS.map((b) => (
                    <button
                      key={b.type}
                      onClick={() => handleAddBlock(b.type)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-indigo-50 hover:text-indigo-700 text-neutral-600 transition-colors cursor-pointer text-left"
                    >
                      <PlusCircle className="w-3 h-3 text-indigo-400 shrink-0" />
                      {b.label}
                    </button>
                  ))}
                </div>
              )}

              {leftPanel === "versions" && (
                <div className="space-y-1">
                  {/* Save version */}
                  <div className="mb-2 space-y-1">
                    <input
                      type="text"
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      placeholder="Version label…"
                      className="w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={handleSaveVersion}
                      disabled={!onSaveVersion}
                      className="w-full text-xs bg-indigo-600 text-white rounded px-2 py-1.5 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      Save milestone version
                    </button>
                  </div>

                  {versions.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 px-1">No versions yet.</p>
                  ) : (
                    versions.map((v) => (
                      <VersionRow
                        key={v.id}
                        version={v}
                        onRestore={handleRestoreVersion}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* CENTER — EDITOR                                                      */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Editor toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={content.title}
              onChange={(e) =>
                setContent((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Article title…"
              className="text-sm font-semibold bg-transparent outline-none text-neutral-800 placeholder-neutral-300 w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            {statusMessage && (
              <span className="text-xs text-indigo-600">{statusMessage}</span>
            )}
            {saving && (
              <span className="text-xs text-neutral-400">Saving…</span>
            )}
            {lastSaved && !saving && (
              <span className="text-xs text-neutral-400">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSaveVersion}
              disabled={!onSaveVersion}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Save version
            </button>
          </div>
        </div>

        {/* Blocks area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {content.document.blocks.length === 0 ? (
              <div className="text-center py-16 text-neutral-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No blocks yet. Add a block from the left panel.</p>
              </div>
            ) : (
              content.document.blocks.map((block) => (
                <div
                  key={block.id}
                  className={cn(
                    "relative transition-all",
                    selectedBlockId === block.id && "ring-2 ring-indigo-300 ring-offset-1 rounded-lg"
                  )}
                  onClick={() => setSelectedBlockId(block.id)}
                >
                  <BlockEditor
                    block={block}
                    onChange={handleBlockChange}
                    onAiReplace={handleAiReplace}
                  />
                  {selectedBlockId === block.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                      className="absolute -top-1.5 -right-1.5 text-[10px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center cursor-pointer hover:bg-red-600"
                      title="Remove block"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))
            )}

            {/* Quick add buttons below content */}
            <div className="pt-2 flex flex-wrap gap-1.5">
              {(["paragraph", "heading", "bulletList", "image", "statistic", "divider"] as BlockType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => handleAddBlock(type)}
                    className="text-[10px] px-2 py-1 rounded border border-dashed border-neutral-300 text-neutral-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    + {type}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT PANEL                                                          */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={cn(
          "flex flex-col border-l border-neutral-200 bg-white transition-all duration-200 shrink-0",
          rightExpanded ? "w-56" : "w-10"
        )}
      >
        <button
          onClick={() => setRightExpanded((p) => !p)}
          className="p-2 flex items-center text-neutral-400 hover:text-neutral-700 cursor-pointer"
        >
          {rightExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {rightExpanded && (
          <>
            <div className="flex flex-wrap border-b border-neutral-100">
              {rightTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanel(tab.id)}
                    className={cn(
                      "flex flex-col items-center py-2 px-1.5 text-[10px] font-medium transition-colors cursor-pointer",
                      rightPanel === tab.id
                        ? "text-indigo-600 border-b-2 border-indigo-600"
                        : "text-neutral-400 hover:text-neutral-700"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {rightPanel === "ai" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">AI Assistant</p>
                  <p className="text-[11px] text-neutral-400">
                    Select a block and click the AI icon to regenerate it.
                    Full OmniRouter integration is pending OR-P06.
                  </p>
                </div>
              )}

              {rightPanel === "seo" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">SEO</p>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Meta title</span>
                    <input
                      type="text"
                      value={(content.seo.metaTitle as string) ?? ""}
                      onChange={(e) =>
                        setContent((p) => ({ ...p, seo: { ...p.seo, metaTitle: e.target.value } }))
                      }
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Meta description</span>
                    <textarea
                      value={(content.seo.metaDescription as string) ?? ""}
                      onChange={(e) =>
                        setContent((p) => ({ ...p, seo: { ...p.seo, metaDescription: e.target.value } }))
                      }
                      rows={3}
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400 resize-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Canonical URL</span>
                    <input
                      type="text"
                      value={(content.seo.canonicalUrl as string) ?? ""}
                      onChange={(e) =>
                        setContent((p) => ({ ...p, seo: { ...p.seo, canonicalUrl: e.target.value } }))
                      }
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
                    />
                  </label>
                </div>
              )}

              {rightPanel === "geo" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">GEO</p>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Geographic focus</span>
                    <input
                      type="text"
                      value={(content.geo.geoFocus as string) ?? ""}
                      onChange={(e) =>
                        setContent((p) => ({ ...p, geo: { ...p.geo, geoFocus: e.target.value } }))
                      }
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
                    />
                  </label>
                </div>
              )}

              {rightPanel === "evidence" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Evidence</p>
                  <p className="text-[11px] text-neutral-400">
                    Attach evidence claims to statistic and citation blocks via evidenceRefs.
                    Evidence library integration is available via Brand Brain.
                  </p>
                </div>
              )}

              {rightPanel === "brand" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Brand</p>
                  <p className="text-[11px] text-neutral-400">
                    Brand voice, terminology, and policies are enforced automatically
                    by the AI review step (pending OR-P06).
                  </p>
                </div>
              )}

              {rightPanel === "links" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Links</p>
                  <p className="text-[11px] text-neutral-400">
                    Internal links use http/https only.
                    javascript: and data: URIs are rejected by the schema validator.
                  </p>
                  {content.relationships.length === 0 ? (
                    <p className="text-[10px] text-neutral-400">No relationships defined.</p>
                  ) : (
                    content.relationships.map((rel, i) => (
                      <div key={i} className="text-[11px] text-neutral-600 bg-neutral-50 rounded px-2 py-1">
                        {(rel as Record<string, unknown>).type as string}:{" "}
                        {((rel as Record<string, unknown>).targetUrl as string) ?? "—"}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
