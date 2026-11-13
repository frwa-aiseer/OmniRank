/**
 * OR-P10 — WordPress HTML Serializer
 *
 * Renders sanitized, WordPress-compatible Gutenberg/HTML blocks from canonical
 * structured JSON (ArticleBlock[]).
 *
 * RULES:
 * - HTML is a derived rendering output ONLY; never persisted as source of truth.
 * - All links are validated: javascript: and data: URIs are stripped.
 * - All HTML script tags, event handlers, and dangerous tags are stripped.
 */

import { ArticleBlock, BlockType } from "../../types/article.ts";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeHref(url?: string): string {
  if (!url || typeof url !== "string") return "#";
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return "#";
  }
  return escapeHtml(trimmed);
}

export function renderBlockToWordPressHtml(block: ArticleBlock): string {
  const c = (block.content ?? {}) as Record<string, any>;

  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(c.level) || 2, 1), 6);
      const text = escapeHtml(String(c.text ?? ""));
      return `<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading">${text}</h${level}>\n<!-- /wp:heading -->`;
    }

    case "paragraph": {
      const text = escapeHtml(String(c.text ?? ""));
      return `<!-- wp:paragraph -->\n<p>${text}</p>\n<!-- /wp:paragraph -->`;
    }

    case "bulletList": {
      const items: string[] = Array.isArray(c.items) ? c.items : [];
      const lis = items.map((it) => `<li>${escapeHtml(String(it))}</li>`).join("\n");
      return `<!-- wp:list -->\n<ul>\n${lis}\n</ul>\n<!-- /wp:list -->`;
    }

    case "numberedList": {
      const items: string[] = Array.isArray(c.items) ? c.items : [];
      const lis = items.map((it) => `<li>${escapeHtml(String(it))}</li>`).join("\n");
      return `<!-- wp:list {"ordered":true} -->\n<ol>\n${lis}\n</ol>\n<!-- /wp:list -->`;
    }

    case "table": {
      const headers: string[] = Array.isArray(c.headers) ? c.headers : [];
      const rows: string[][] = Array.isArray(c.rows) ? c.rows : [];
      const caption = c.caption ? `<figcaption>${escapeHtml(String(c.caption))}</figcaption>` : "";

      const ths = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
      const trs = rows
        .map((r) => `<tr>${(r ?? []).map((td) => `<td>${escapeHtml(String(td))}</td>`).join("")}</tr>`)
        .join("\n");

      return `<!-- wp:table -->\n<figure class="wp-block-table"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>${caption}</figure>\n<!-- /wp:table -->`;
    }

    case "comparisonTable": {
      const headers: string[] = Array.isArray(c.headers) ? c.headers : ["Feature", "Our Brand", "Competitor"];
      const rows: any[] = Array.isArray(c.rows) ? c.rows : [];

      const ths = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
      const trs = rows
        .map((r) => {
          if (Array.isArray(r)) {
            return `<tr>${r.map((td) => `<td>${escapeHtml(String(td))}</td>`).join("")}</tr>`;
          }
          if (typeof r === "object" && r !== null) {
            return `<tr>${headers.map((h) => `<td>${escapeHtml(String(r[h] ?? ""))}</td>`).join("")}</tr>`;
          }
          return "";
        })
        .join("\n");

      return `<!-- wp:table {"className":"is-style-stripes"} -->\n<figure class="wp-block-table is-style-stripes"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></figure>\n<!-- /wp:table -->`;
    }

    case "image": {
      const src = sanitizeHref(c.url);
      const alt = escapeHtml(String(c.alt ?? c.caption ?? ""));
      const caption = c.caption ? `<figcaption class="wp-element-caption">${escapeHtml(String(c.caption))}</figcaption>` : "";
      return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${src}" alt="${alt}"/>${caption}</figure>\n<!-- /wp:image -->`;
    }

    case "youtube": {
      const url = sanitizeHref(c.url);
      return `<!-- wp:embed {"url":"${url}","type":"video","providerNameSlug":"youtube","responsive":true} -->\n<figure class="wp-block-embed is-type-video is-provider-youtube"><div class="wp-block-embed__wrapper">\n${url}\n</div></figure>\n<!-- /wp:embed -->`;
    }

    case "quote": {
      const text = escapeHtml(String(c.text ?? ""));
      const author = c.author ? `<cite>${escapeHtml(String(c.author))}</cite>` : "";
      return `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${text}</p>${author}</blockquote>\n<!-- /wp:quote -->`;
    }

    case "statistic": {
      const stat = escapeHtml(String(c.stat ?? c.text ?? ""));
      const label = escapeHtml(String(c.label ?? c.description ?? ""));
      return `<!-- wp:group {"className":"omnirank-stat-card"} -->\n<div class="wp-block-group omnirank-stat-card"><h3>${stat}</h3><p>${label}</p></div>\n<!-- /wp:group -->`;
    }

    case "callout": {
      const text = escapeHtml(String(c.text ?? ""));
      const title = c.title ? `<strong>${escapeHtml(String(c.title))}</strong> ` : "";
      return `<!-- wp:group {"className":"omnirank-callout"} -->\n<div class="wp-block-group omnirank-callout"><p>${title}${text}</p></div>\n<!-- /wp:group -->`;
    }

    case "cta": {
      const text = escapeHtml(String(c.buttonText ?? c.text ?? "Learn More"));
      const href = sanitizeHref(c.url);
      return `<!-- wp:buttons -->\n<div class="wp-block-buttons"><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="${href}">${text}</a></div></div>\n<!-- /wp:buttons -->`;
    }

    case "faq": {
      const q = escapeHtml(String(c.question ?? ""));
      const a = escapeHtml(String(c.answer ?? ""));
      return `<!-- wp:group {"className":"omnirank-faq-item"} -->\n<div class="wp-block-group omnirank-faq-item"><h4>${q}</h4><p>${a}</p></div>\n<!-- /wp:group -->`;
    }

    case "code": {
      const code = escapeHtml(String(c.code ?? c.text ?? ""));
      const lang = escapeHtml(String(c.language ?? "typescript"));
      return `<!-- wp:code -->\n<pre class="wp-block-code"><code class="language-${lang}">${code}</code></pre>\n<!-- /wp:code -->`;
    }

    case "citation": {
      const source = escapeHtml(String(c.source ?? c.text ?? ""));
      const href = c.url ? ` <a href="${sanitizeHref(c.url)}" target="_blank" rel="noopener noreferrer">[source]</a>` : "";
      return `<!-- wp:paragraph {"className":"omnirank-citation"} -->\n<p class="omnirank-citation"><em>Citation: ${source}${href}</em></p>\n<!-- /wp:paragraph -->`;
    }

    case "divider": {
      return `<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->`;
    }

    default: {
      const rawText = escapeHtml(String(c.text ?? JSON.stringify(c)));
      return `<!-- wp:paragraph -->\n<p>${rawText}</p>\n<!-- /wp:paragraph -->`;
    }
  }
}

export function serializeDocumentToWordPressHtml(blocks: ArticleBlock[]): string {
  return blocks.map(renderBlockToWordPressHtml).join("\n\n");
}
