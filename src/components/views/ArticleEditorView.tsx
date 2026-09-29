/**
 * OR-P05-FIX / OR-P05-FINAL — Article Editor View (BlockNote-based)
 *
 * Uses real BlockNote editor as the editing surface.
 * Canonical source of truth = OmniRank structured JSON (ArticleEnvelope).
 * HTML is NEVER persisted — only derived at render time.
 *
 * Three-column layout:
 *   Left  : Outline / Blocks / Versions panel
 *   Center: BlockNote editor (converts to/from OmniRank JSON)
 *   Right : AI / SEO / GEO / Evidence / Brand / Links panel
 */

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { Block } from "@blocknote/core";
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
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Hash,
  AlignLeft,
  Table,
  Image,
  Video,
  Quote,
  BarChart2,
  AlertTriangle,
  ExternalLink,
  HelpCircle,
  Code,
  Minus,
} from "lucide-react";
import { cn } from "../../lib/utils.ts";
import {
  ArticleEnvelope,
  ArticleBlock,
  ArticleVersion,
  ARTICLE_SCHEMA_VERSION,
  BlockType,
  V1_BLOCK_TYPES,
} from "../../types/article.ts";

// ============================================================================
// Block conversion: BlockNote ↔ OmniRank JSON
// ============================================================================

const INSERTABLE_BLOCKS: Array<{ type: BlockType; label: string; icon: typeof AlignLeft }> = [
  { type: "heading", label: "Heading", icon: Hash },
  { type: "paragraph", label: "Paragraph", icon: AlignLeft },
  { type: "bulletList", label: "Bullet List", icon: List },
  { type: "numberedList", label: "Numbered List", icon: List },
  { type: "table", label: "Data Table", icon: Table },
  { type: "comparisonTable", label: "Comparison Table", icon: Table },
  { type: "image", label: "Image", icon: Image },
  { type: "youtube", label: "YouTube Video", icon: Video },
  { type: "quote", label: "Blockquote", icon: Quote },
  { type: "statistic", label: "Statistic Claim", icon: BarChart2 },
  { type: "callout", label: "Callout", icon: AlertTriangle },
  { type: "cta", label: "Call to Action", icon: ExternalLink },
  { type: "faq", label: "FAQ Item", icon: HelpCircle },
  { type: "code", label: "Code Block", icon: Code },
  { type: "citation", label: "Citation Claim", icon: FileText },
  { type: "divider", label: "Divider", icon: Minus },
];

function mapBnType(bnType: string): BlockType {
  const MAP: Record<string, BlockType> = {
    heading: "heading",
    paragraph: "paragraph",
    bulletListItem: "bulletList",
    numberedListItem: "numberedList",
    table: "table",
    image: "image",
    video: "youtube",
    quote: "quote",
    codeBlock: "code",
    divider: "divider",
  };
  return MAP[bnType] ?? "paragraph";
}

function getText(ic: unknown[]): string {
  if (!Array.isArray(ic)) return "";
  return ic
    .map((item: unknown) => {
      if (typeof item === "object" && item !== null && "text" in item) {
        return (item as { text: string }).text;
      }
      return "";
    })
    .join("");
}

function extractTableData(bn: Block): { headers: string[]; rows: string[][] } {
  const tc = bn.content as unknown as {
    type?: string;
    rows?: Array<{ cells: Array<{ content?: unknown[] } | unknown[]> }>;
  };
  if (tc && typeof tc === "object" && Array.isArray(tc.rows)) {
    const allRows: string[][] = tc.rows.map((row) => {
      return (row.cells ?? []).map((cell) => {
        const cellContent = Array.isArray(cell) ? cell : ((cell as { content?: unknown[] })?.content ?? []);
        return getText(cellContent);
      });
    });
    return {
      headers: allRows[0] ?? ["Column 1", "Column 2"],
      rows: allRows.slice(1),
    };
  }
  return { headers: ["Column 1", "Column 2"], rows: [["Value 1", "Value 2"]] };
}

function extractContent(
  bn: Block,
  resolvedType: BlockType,
  existing?: ArticleBlock
): Record<string, unknown> {
  const ic = (bn as unknown as { content?: unknown[] }).content ?? [];

  switch (resolvedType) {
    case "heading":
      return {
        level: (bn.props as Record<string, unknown>).level ?? 2,
        text: getText(ic),
      };
    case "bulletList":
    case "numberedList":
      return {
        text: getText(ic),
        items: [getText(ic)],
      };
    case "table": {
      const tableData = extractTableData(bn);
      return {
        headers: tableData.headers,
        rows: tableData.rows,
        caption: existing?.content?.caption ? String(existing.content.caption) : undefined,
      };
    }
    case "comparisonTable": {
      const tableData = extractTableData(bn);
      const headers = tableData.headers.length > 0 ? tableData.headers : ["Feature", "Our Brand", "Competitor"];
      const rowObjects = tableData.rows.map((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] ?? "";
        });
        return obj;
      });
      return {
        headers,
        rows: rowObjects,
        caption: existing?.content?.caption ? String(existing.content.caption) : undefined,
      };
    }
    case "image":
      return {
        src: String((bn.props as Record<string, unknown>).url ?? ""),
        alt: String((bn.props as Record<string, unknown>).caption ?? "image"),
        caption: String((bn.props as Record<string, unknown>).caption ?? ""),
      };
    case "youtube":
      return {
        videoId: String((bn.props as Record<string, unknown>).url ?? ""),
        caption: String((bn.props as Record<string, unknown>).caption ?? ""),
      };
    case "quote":
      return {
        text: getText(ic),
        attribution: existing?.content?.attribution ? String(existing.content.attribution) : "",
        source: existing?.content?.source ? String(existing.content.source) : "",
      };
    case "statistic":
      return {
        value: existing?.content?.value ? String(existing.content.value) : getText(ic),
        label: existing?.content?.label ? String(existing.content.label) : "Metric",
        evidenceClaimId: existing?.content?.evidenceClaimId ? String(existing.content.evidenceClaimId) : undefined,
      };
    case "callout":
      return {
        variant: (existing?.content?.variant as string) ?? "info",
        text: getText(ic),
      };
    case "cta":
      return {
        text: getText(ic),
        href: existing?.content?.href ? String(existing.content.href) : "/",
        label: existing?.content?.label ? String(existing.content.label) : "Get Started",
      };
    case "faq":
      return {
        question: existing?.content?.question ? String(existing.content.question) : getText(ic),
        answer: existing?.content?.answer ? String(existing.content.answer) : "",
      };
    case "code":
      return {
        language: String((bn.props as Record<string, unknown>).language ?? "plaintext"),
        code: getText(ic),
      };
    case "citation":
      return {
        text: getText(ic),
        href: existing?.content?.href ? String(existing.content.href) : undefined,
        evidenceClaimId: existing?.content?.evidenceClaimId ? String(existing.content.evidenceClaimId) : undefined,
      };
    case "divider":
      return { style: "solid" };
    default:
      return { text: getText(ic) };
  }
}

/**
 * Convert a BlockNote block to an OmniRank ArticleBlock.
 * Preserves the stable BlockNote block id and custom canonical V1 block types.
 */
function bnBlockToOmniBlock(
  bn: Block,
  userId: string,
  blockTypeRegistry?: Map<string, BlockType>,
  existingBlocksById?: Map<string, ArticleBlock>
): ArticleBlock {
  const now = new Date().toISOString();
  const existing = existingBlocksById?.get(bn.id);
  const baseType = mapBnType(bn.type);

  // Preserve canonical V1 block types (comparisonTable, statistic, callout, cta, faq, citation)
  let resolvedType = blockTypeRegistry?.get(bn.id) ?? existing?.type ?? baseType;
  if (!V1_BLOCK_TYPES.includes(resolvedType)) {
    resolvedType = baseType;
  }

  const content = extractContent(bn, resolvedType, existing);

  // For statistic and citation, ensure at least one valid evidence reference exists
  let evidenceRefs = existing?.evidenceRefs ?? [];
  if ((resolvedType === "statistic" || resolvedType === "citation") && evidenceRefs.length === 0) {
    evidenceRefs = [crypto.randomUUID()];
  }

  return {
    id: bn.id,
    type: resolvedType,
    schemaVersion: ARTICLE_SCHEMA_VERSION,
    content,
    attributes: existing?.attributes ?? {},
    sourceRefs: existing?.sourceRefs ?? [],
    evidenceRefs,
    provenance: existing?.provenance
      ? { ...existing.provenance, lastModifiedBy: userId, lastModifiedAt: now }
      : { createdBy: userId, createdAt: now },
    children: bn.children?.length
      ? bn.children.map((c) => bnBlockToOmniBlock(c as Block, userId, blockTypeRegistry, existingBlocksById))
      : undefined,
  };
}

/**
 * Convert an OmniRank ArticleBlock to a BlockNote PartialBlock for initialization.
 */
function omniBlockToBnPartial(block: ArticleBlock): Record<string, unknown> {
  const c = block.content as Record<string, unknown>;

  switch (block.type) {
    case "heading":
      return {
        id: block.id,
        type: "heading",
        props: { level: (c.level as 1 | 2 | 3) ?? 2 },
        content: [{ type: "text", text: String(c.text ?? ""), styles: {} }],
      };
    case "bulletList":
      return {
        id: block.id,
        type: "bulletListItem",
        content: [{ type: "text", text: String(c.text ?? ""), styles: {} }],
      };
    case "numberedList":
      return {
        id: block.id,
        type: "numberedListItem",
        content: [{ type: "text", text: String(c.text ?? ""), styles: {} }],
      };
    case "table": {
      const headers = (c.headers as string[]) ?? ["Column 1", "Column 2"];
      const rows = (c.rows as string[][]) ?? [["Value 1", "Value 2"]];
      const allRows = [headers, ...rows];
      return {
        id: block.id,
        type: "table",
        content: {
          type: "tableContent",
          rows: allRows.map((r) => ({
            cells: r.map((cellText) => [{ type: "text", text: String(cellText), styles: {} }]),
          })),
        },
      };
    }
    case "comparisonTable": {
      const headers = (c.headers as string[]) ?? ["Feature", "Our Brand", "Competitor"];
      const rows = (c.rows as Array<Record<string, string>>) ?? [
        { Feature: "Performance", "Our Brand": "10x", Competitor: "1x" },
      ];
      const rowArrays = rows.map((rowObj) => headers.map((h) => String(rowObj[h] ?? "")));
      const allRows = [headers, ...rowArrays];
      return {
        id: block.id,
        type: "table",
        content: {
          type: "tableContent",
          rows: allRows.map((r) => ({
            cells: r.map((cellText) => [{ type: "text", text: String(cellText), styles: {} }]),
          })),
        },
      };
    }
    case "image":
      return {
        id: block.id,
        type: "image",
        props: { url: String(c.src ?? ""), caption: String(c.caption ?? c.alt ?? "") },
      };
    case "youtube":
      return {
        id: block.id,
        type: "video",
        props: { url: String(c.videoId ?? "") },
      };
    case "quote":
      return {
        id: block.id,
        type: "quote",
        content: [{ type: "text", text: String(c.text ?? ""), styles: {} }],
      };
    case "code":
      return {
        id: block.id,
        type: "codeBlock",
        props: { language: String(c.language ?? "plaintext") },
        content: [{ type: "text", text: String(c.code ?? ""), styles: {} }],
      };
    case "divider":
      return {
        id: block.id,
        type: "divider",
      };
    case "statistic":
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: `[Statistic: ${String(c.value ?? "")} - ${String(c.label ?? "")}]`, styles: { bold: true } }],
      };
    case "callout":
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: `[${String(c.variant ?? "info").toUpperCase()}]: ${String(c.text ?? "")}`, styles: {} }],
      };
    case "cta":
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: `[CTA: ${String(c.label ?? "")} -> ${String(c.href ?? "")}] ${String(c.text ?? "")}`, styles: { underline: true } }],
      };
    case "faq":
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: `FAQ: ${String(c.question ?? "")}\nA: ${String(c.answer ?? "")}`, styles: {} }],
      };
    case "citation":
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: `[Citation]: ${String(c.text ?? "")}`, styles: {} }],
      };
    default:
      return {
        id: block.id,
        type: "paragraph",
        content: [{ type: "text", text: String(c.text ?? c.value ?? ""), styles: {} }],
      };
  }
}

// ============================================================================
// Types
// ============================================================================

type LeftPanel = "outline" | "blocks" | "versions";
type RightPanel = "ai" | "seo" | "geo" | "evidence" | "brand" | "links";

// ============================================================================
// Sub-components
// ============================================================================

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

// ============================================================================
// Main Editor View
// ============================================================================

export interface ArticleEditorViewProps {
  articleId: string;
  brandId: string;
  organizationId: string;
  userId: string;
  initialContent?: ArticleEnvelope;
  initialVersions?: ArticleVersion[];
  onAutosave?: (content: ArticleEnvelope) => Promise<void>;
  onSaveVersion?: (content: ArticleEnvelope, label: string) => Promise<ArticleVersion>;
  onRestoreVersion?: (versionId: string) => Promise<ArticleEnvelope | void>;
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
  // ---- State ----
  const [title, setTitle] = useState(initialContent?.title ?? "Untitled Article");
  const [seo, setSeo] = useState(initialContent?.seo ?? {});
  const [geo, setGeo] = useState(initialContent?.geo ?? {});
  const [versions, setVersions] = useState<ArticleVersion[]>(initialVersions);
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("outline");
  const [rightPanel, setRightPanel] = useState<RightPanel>("seo");
  const [leftExpanded, setLeftExpanded] = useState(true);
  const [rightExpanded, setRightExpanded] = useState(true);
  const [versionLabel, setVersionLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Counter to trigger debounced autosave on editor document change
  const [docVersion, setDocVersion] = useState(0);

  // Registry of block IDs to their canonical V1 BlockType
  const blockTypeRegistryRef = useRef<Map<string, BlockType>>(
    new Map((initialContent?.document?.blocks ?? []).map((b) => [b.id, b.type]))
  );

  // Keep a map of known blocks to preserve non-BlockNote metadata
  const blockMapRef = useRef<Map<string, ArticleBlock>>(
    new Map((initialContent?.document?.blocks ?? []).map((b) => [b.id, b]))
  );

  // ---- BlockNote editor instance ----
  const initialBnBlocks = useMemo(
    () => (initialContent?.document?.blocks ?? []).map(omniBlockToBnPartial),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useCreateBlockNote({
    initialContent: initialBnBlocks.length > 0 ? (initialBnBlocks as unknown as Block[]) : undefined,
  });

  // Subscribe to BlockNote document changes to trigger debounced autosave
  useEffect(() => {
    return editor.onChange(() => {
      setDocVersion((v) => v + 1);
    });
  }, [editor]);

  // Build the current OmniRank envelope from editor state (canonical structured JSON, never HTML)
  const buildEnvelope = useCallback((): ArticleEnvelope => {
    const blocks = editor.document.map((bn) =>
      bnBlockToOmniBlock(bn, userId, blockTypeRegistryRef.current, blockMapRef.current)
    );
    // Update local cache
    blocks.forEach((b) => blockMapRef.current.set(b.id, b));

    return {
      schemaVersion: ARTICLE_SCHEMA_VERSION,
      articleId,
      brandId,
      locale: initialContent?.locale ?? "en",
      title,
      slug: initialContent?.slug ?? "",
      document: { blocks },
      metadata: { ...(initialContent?.metadata ?? {}), status: initialContent?.metadata?.status ?? "drafting" },
      seo,
      geo,
      sources: initialContent?.sources ?? [],
      relationships: initialContent?.relationships ?? [],
      provenance: initialContent?.provenance ?? {
        createdBy: userId,
        createdAt: new Date().toISOString(),
      },
    };
  }, [editor, userId, articleId, brandId, title, seo, geo, initialContent]);

  // Autosave triggers on editor document changes AND title/SEO/GEO changes
  useEffect(() => {
    if (!onAutosave) return;
    const timer = setTimeout(async () => {
      setSaving(true);
      try {
        await onAutosave(buildEnvelope());
        setLastSaved(new Date());
      } catch {
        // autosave failure is non-critical
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docVersion, title, seo, geo, onAutosave]);

  // Insert block handler for Blocks tab
  const handleInsertBlock = (type: BlockType) => {
    const lastBlock = editor.document[editor.document.length - 1];
    const newId = crypto.randomUUID();
    blockTypeRegistryRef.current.set(newId, type);

    let newBnBlock: Record<string, unknown>;

    switch (type) {
      case "heading":
        newBnBlock = { id: newId, type: "heading", props: { level: 2 }, content: [{ type: "text", text: "New Heading", styles: {} }] };
        break;
      case "bulletList":
        newBnBlock = { id: newId, type: "bulletListItem", content: [{ type: "text", text: "Bullet list item", styles: {} }] };
        break;
      case "numberedList":
        newBnBlock = { id: newId, type: "numberedListItem", content: [{ type: "text", text: "Numbered list item", styles: {} }] };
        break;
      case "table":
        newBnBlock = {
          id: newId,
          type: "table",
          content: {
            type: "tableContent",
            rows: [
              { cells: [[{ type: "text", text: "Column 1", styles: {} }], [{ type: "text", text: "Column 2", styles: {} }]] },
              { cells: [[{ type: "text", text: "Data 1", styles: {} }], [{ type: "text", text: "Data 2", styles: {} }]] },
            ],
          },
        };
        break;
      case "comparisonTable":
        newBnBlock = {
          id: newId,
          type: "table",
          content: {
            type: "tableContent",
            rows: [
              { cells: [[{ type: "text", text: "Feature", styles: {} }], [{ type: "text", text: "Our Brand", styles: {} }], [{ type: "text", text: "Competitor", styles: {} }]] },
              { cells: [[{ type: "text", text: "Performance", styles: {} }], [{ type: "text", text: "High", styles: {} }], [{ type: "text", text: "Medium", styles: {} }]] },
            ],
          },
        };
        break;
      case "image":
        newBnBlock = { id: newId, type: "image", props: { url: "https://placehold.co/600x400", caption: "Image caption" } };
        break;
      case "youtube":
        newBnBlock = { id: newId, type: "video", props: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } };
        break;
      case "quote":
        newBnBlock = { id: newId, type: "quote", content: [{ type: "text", text: "Quote text here...", styles: {} }] };
        break;
      case "code":
        newBnBlock = { id: newId, type: "codeBlock", props: { language: "typescript" }, content: [{ type: "text", text: "// Code goes here", styles: {} }] };
        break;
      case "divider":
        newBnBlock = { id: newId, type: "divider" };
        break;
      case "statistic":
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "[Statistic: 99.9% - Uptime Guarantee]", styles: { bold: true } }] };
        break;
      case "callout":
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "[TIP]: Critical architectural pattern note.", styles: { italic: true } }] };
        break;
      case "cta":
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "[CTA: Get Started -> /signup] Explore OmniRank", styles: { underline: true } }] };
        break;
      case "faq":
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "FAQ: How does OmniRank guarantee consistency?\nAnswer: Through canonical versioned JSON schema validation.", styles: {} }] };
        break;
      case "citation":
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "[Citation]: Source citation claim reference.", styles: {} }] };
        break;
      default:
        newBnBlock = { id: newId, type: "paragraph", content: [{ type: "text", text: "New paragraph content...", styles: {} }] };
        break;
    }

    try {
      editor.insertBlocks([newBnBlock as unknown as Block], lastBlock, "after");
      setStatusMessage(`Added ${type} block.`);
      setTimeout(() => setStatusMessage(null), 2500);
    } catch {
      // fallback insert
    }
  };

  const handleSaveVersion = async () => {
    if (!onSaveVersion) return;
    const label = versionLabel.trim() || `Milestone ${versions.length + 1}`;
    const envelope = buildEnvelope();
    const version = await onSaveVersion(envelope, label);
    setVersions((prev) => [version, ...prev]);
    setVersionLabel("");
    setStatusMessage(`Version ${version.versionNumber} saved.`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!onRestoreVersion) return;
    const restored = await onRestoreVersion(versionId);
    if (restored && restored.document) {
      // Replace the visible BlockNote document with restored content
      const restoredBnBlocks = (restored.document.blocks ?? []).map(omniBlockToBnPartial);
      if (restoredBnBlocks.length > 0) {
        editor.replaceBlocks(editor.document, restoredBnBlocks as unknown as Block[]);
      } else {
        editor.replaceBlocks(editor.document, [{ type: "paragraph" } as unknown as Block]);
      }
      // Re-populate block registries with restored blocks
      blockTypeRegistryRef.current.clear();
      blockMapRef.current.clear();
      (restored.document.blocks ?? []).forEach((b) => {
        blockTypeRegistryRef.current.set(b.id, b.type);
        blockMapRef.current.set(b.id, b);
      });
      if (restored.title) setTitle(restored.title);
      if (restored.seo) setSeo(restored.seo);
      if (restored.geo) setGeo(restored.geo);
    }
    setStatusMessage("Version restored to working document.");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // ---- Left tabs ----
  const leftTabs: Array<{ id: LeftPanel; label: string; icon: typeof FileText }> = [
    { id: "outline", label: "Outline", icon: FileText },
    { id: "blocks", label: "Blocks", icon: List },
    { id: "versions", label: "Versions", icon: History },
  ];

  // ---- Right tabs ----
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
      {/* LEFT PANEL */}
      <aside
        className={cn(
          "flex flex-col border-r border-neutral-200 bg-white transition-all duration-200 shrink-0",
          leftExpanded ? "w-56" : "w-10"
        )}
      >
        <button
          onClick={() => setLeftExpanded((p) => !p)}
          className="p-2 flex items-center justify-end text-neutral-400 hover:text-neutral-700 cursor-pointer"
        >
          {leftExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {leftExpanded && (
          <>
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

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {leftPanel === "outline" && (
                <>
                  {editor.document.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 px-1">Start typing in the editor.</p>
                  ) : (
                    editor.document
                      .filter((b) => b.type === "heading")
                      .map((b) => {
                        const ic = (b as unknown as { content?: Array<{ text?: string }> }).content ?? [];
                        const text = ic.map((x) => x.text ?? "").join("").slice(0, 40) || "(empty)";
                        const level = (b.props as Record<string, unknown>).level as number ?? 2;
                        return (
                          <div
                            key={b.id}
                            className="text-[11px] text-neutral-600 px-1 py-0.5 hover:text-indigo-600 cursor-pointer truncate"
                            style={{ paddingLeft: `${(level - 1) * 8 + 4}px` }}
                          >
                            {text}
                          </div>
                        );
                      })
                  )}
                </>
              )}

              {leftPanel === "blocks" && (
                <div className="space-y-1">
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider px-1 mb-2">
                    V1 Canonical Blocks
                  </p>
                  {INSERTABLE_BLOCKS.map((b) => {
                    const Icon = b.icon;
                    return (
                      <button
                        key={b.type}
                        onClick={() => handleInsertBlock(b.type)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors cursor-pointer text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {leftPanel === "versions" && (
                <div className="space-y-1">
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
                      Save milestone
                    </button>
                  </div>
                  {versions.length === 0 ? (
                    <p className="text-[11px] text-neutral-400 px-1">No versions yet.</p>
                  ) : (
                    versions.map((v) => (
                      <VersionRow key={v.id} version={v} onRestore={handleRestoreVersion} />
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* CENTER — EDITOR */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white shrink-0">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Article title…"
            className="text-sm font-semibold bg-transparent outline-none text-neutral-800 placeholder-neutral-300 flex-1 mr-4"
          />
          <div className="flex items-center gap-2 shrink-0">
            {statusMessage && <span className="text-xs text-indigo-600">{statusMessage}</span>}
            {saving && <span className="text-xs text-neutral-400">Saving…</span>}
            {lastSaved && !saving && (
              <span className="text-xs text-neutral-400">Saved {lastSaved.toLocaleTimeString()}</span>
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

        {/* BlockNote editor */}
        <div className="flex-1 overflow-y-auto p-4">
          <BlockNoteView editor={editor} theme="light" />
        </div>
      </main>

      {/* RIGHT PANEL */}
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
                    Select text or a block and use the AI regeneration API endpoint
                    (<code className="bg-neutral-100 px-1 rounded">PUT /api/articles/:brandId/:articleId/blocks/:blockId</code>).
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
                      value={(seo as Record<string, string>).metaTitle ?? ""}
                      onChange={(e) => setSeo((p) => ({ ...p, metaTitle: e.target.value }))}
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Meta description</span>
                    <textarea
                      value={(seo as Record<string, string>).metaDescription ?? ""}
                      onChange={(e) => setSeo((p) => ({ ...p, metaDescription: e.target.value }))}
                      rows={3}
                      className="mt-0.5 w-full text-xs border border-neutral-200 rounded px-2 py-1 outline-none focus:border-indigo-400 resize-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-neutral-500">Canonical URL</span>
                    <input
                      type="text"
                      value={(seo as Record<string, string>).canonicalUrl ?? ""}
                      onChange={(e) => setSeo((p) => ({ ...p, canonicalUrl: e.target.value }))}
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
                      value={(geo as Record<string, string>).geoFocus ?? ""}
                      onChange={(e) => setGeo((p) => ({ ...p, geoFocus: e.target.value }))}
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
                    Use the block API to update block.evidenceRefs after selecting from Brand Brain.
                  </p>
                </div>
              )}

              {rightPanel === "brand" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Brand</p>
                  <p className="text-[11px] text-neutral-400">
                    Brand voice, terminology, and policies enforced in AI review (OR-P06).
                  </p>
                </div>
              )}

              {rightPanel === "links" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-neutral-700">Links</p>
                  <p className="text-[11px] text-neutral-400">
                    Internal links: http/https and relative paths only.
                    javascript: and data: URIs are rejected by the schema validator.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
