import { DocumentFileType } from "../../types/index.ts";

export interface ParsedDocumentResult {
  title: string;
  extractedText: string;
  documentMetadata: Record<string, unknown>;
  fileType: DocumentFileType;
}

export class DocumentParsers {
  /**
   * Main entry point to parse various document formats into structured text
   */
  static parse(
    rawContent: string | Uint8Array,
    fileType: DocumentFileType,
    suggestedTitle?: string
  ): ParsedDocumentResult {
    const textContent = typeof rawContent === "string" ? rawContent : new TextDecoder().decode(rawContent);

    switch (fileType) {
      case "md":
        return this.parseMarkdown(textContent, suggestedTitle);
      case "html":
        return this.parseHtml(textContent, suggestedTitle);
      case "csv":
        return this.parseCsv(textContent, suggestedTitle);
      case "xlsx":
        return this.parseXlsx(textContent, suggestedTitle);
      case "pdf":
        return this.parsePdf(textContent, suggestedTitle);
      case "docx":
        return this.parseDocx(textContent, suggestedTitle);
      case "note":
      case "txt":
      default:
        return this.parsePlainText(textContent, fileType, suggestedTitle);
    }
  }

  private static parseMarkdown(text: string, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || "Markdown Document";
    const titleMatch = text.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract frontmatter if present
    let cleanText = text;
    let frontmatter: Record<string, string> = {};
    if (text.startsWith("---")) {
      const endFm = text.indexOf("---", 3);
      if (endFm !== -1) {
        const fmContent = text.slice(3, endFm).trim();
        cleanText = text.slice(endFm + 3).trim();
        fmContent.split("\n").forEach((line) => {
          const [k, ...v] = line.split(":");
          if (k && v.length) {
            frontmatter[k.trim()] = v.join(":").trim().replace(/^['"]|['"]$/g, "");
          }
        });
        if (frontmatter.title) {
          title = frontmatter.title;
        }
      }
    }

    return {
      title,
      extractedText: cleanText,
      documentMetadata: {
        format: "markdown",
        headingsCount: (cleanText.match(/^#{1,6}\s+/gm) || []).length,
        hasCodeBlocks: cleanText.includes("```"),
        frontmatter
      },
      fileType: "md"
    };
  }

  private static parseHtml(html: string, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || "Web Page";
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/&[a-z]+;/gi, " ").trim();
    } else {
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        title = h1Match[1].replace(/<[^>]+>/g, "").trim();
      }
    }

    // Strip scripts, styles, header, footer, nav
    let text = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, "");

    // Convert headings to markdown-like headings
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<[^>]+>/g, ""); // Strip remaining tags

    // Decode standard HTML entities
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean excess whitespace
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return {
      title,
      extractedText: text,
      documentMetadata: {
        format: "html",
        rawLength: html.length,
        extractedLength: text.length
      },
      fileType: "html"
    };
  }

  private static parseCsv(csvText: string, suggestedTitle?: string): ParsedDocumentResult {
    const title = suggestedTitle || "Structured CSV Dataset";
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return {
        title,
        extractedText: "",
        documentMetadata: { rowCount: 0, columnCount: 0 },
        fileType: "csv"
      };
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
    const records: string[] = [];

    records.push(`### Dataset: ${title}`);
    records.push(`Columns: ${headers.join(", ")}\n`);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^["']|["']$/g, ""));
      const fields = headers.map((h, idx) => `${h}: ${values[idx] || "N/A"}`).join(" | ");
      records.push(`Row ${i}: ${fields}`);
    }

    return {
      title,
      extractedText: records.join("\n"),
      documentMetadata: {
        format: "csv",
        rowCount: lines.length - 1,
        columnCount: headers.length,
        headers
      },
      fileType: "csv"
    };
  }

  private static parseXlsx(content: string, suggestedTitle?: string): ParsedDocumentResult {
    const title = suggestedTitle || "Spreadsheet Document";
    // For text representations or extracted sheet data:
    return {
      title,
      extractedText: content.trim(),
      documentMetadata: {
        format: "xlsx",
        isTabular: true
      },
      fileType: "xlsx"
    };
  }

  private static parsePdf(content: string, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || "PDF Document";
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines[0].length < 100) {
      title = lines[0];
    }

    return {
      title,
      extractedText: content.trim(),
      documentMetadata: {
        format: "pdf",
        estimatedPages: Math.max(1, Math.ceil(content.length / 2500))
      },
      fileType: "pdf"
    };
  }

  private static parseDocx(content: string, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || "Word Document";
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines[0].length < 100) {
      title = lines[0];
    }

    return {
      title,
      extractedText: content.trim(),
      documentMetadata: {
        format: "docx",
        characterCount: content.length
      },
      fileType: "docx"
    };
  }

  private static parsePlainText(content: string, fileType: DocumentFileType, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || (fileType === "note" ? "Brand Note" : "Plain Text Document");
    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && lines[0].length < 80) {
      title = lines[0].replace(/^[#\-*\s]+/, "");
    }

    return {
      title,
      extractedText: content.trim(),
      documentMetadata: {
        format: fileType,
        linesCount: lines.length
      },
      fileType
    };
  }
}
