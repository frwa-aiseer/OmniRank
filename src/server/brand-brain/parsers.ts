import { createRequire } from "module";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { parse as parseCsvSync } from "csv-parse/sync";
import { DocumentFileType } from "../../types/index.ts";

const require = createRequire(import.meta.url);
const pdfLib = require("pdf-parse");

export interface ParsedDocumentResult {
  title: string;
  extractedText: string;
  documentMetadata: Record<string, unknown>;
  fileType: DocumentFileType;
}

export class ParserSecurityError extends Error {
  constructor(message: string) {
    super(`[Parser Security Error] ${message}`);
    this.name = "ParserSecurityError";
  }
}

export class DocumentParsers {
  /**
   * Universal asynchronous parser supporting all formats (binary PDF, binary DOCX, binary XLSX, CSV, HTML, MD, TXT).
   */
  static async parseAsync(
    rawContent: string | Uint8Array | Buffer,
    fileType: DocumentFileType,
    suggestedTitle?: string
  ): Promise<ParsedDocumentResult> {
    const buffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : typeof rawContent === "string"
      ? Buffer.from(rawContent, "utf-8")
      : Buffer.from(rawContent);

    this.assertNoExecutableMacros(buffer, fileType);

    switch (fileType) {
      case "pdf":
        return await this.parsePdf(buffer, suggestedTitle);
      case "docx":
        return await this.parseDocx(buffer, suggestedTitle);
      case "xlsx":
        return this.parseXlsx(buffer, suggestedTitle);
      case "csv":
        return this.parseCsv(buffer.toString("utf-8"), suggestedTitle);
      case "md":
        return this.parseMarkdown(buffer.toString("utf-8"), suggestedTitle);
      case "html":
        return this.parseHtml(buffer.toString("utf-8"), suggestedTitle);
      case "note":
      case "txt":
      default:
        return this.parsePlainText(buffer.toString("utf-8"), fileType, suggestedTitle);
    }
  }

  /**
   * Synchronous parser for non-async formats (MD, HTML, CSV, XLSX, TXT, Note).
   * For binary PDF/DOCX, delegates to async.
   */
  static parse(
    rawContent: string | Uint8Array | Buffer,
    fileType: "md" | "html" | "txt" | "note" | "csv" | "xlsx",
    suggestedTitle?: string
  ): ParsedDocumentResult;
  static parse(
    rawContent: string | Uint8Array | Buffer,
    fileType: DocumentFileType,
    suggestedTitle?: string
  ): ParsedDocumentResult | Promise<ParsedDocumentResult>;
  static parse(
    rawContent: string | Uint8Array | Buffer,
    fileType: DocumentFileType,
    suggestedTitle?: string
  ): ParsedDocumentResult | Promise<ParsedDocumentResult> {
    if (fileType === "pdf" || fileType === "docx") {
      return this.parseAsync(rawContent, fileType, suggestedTitle);
    }

    const buffer = Buffer.isBuffer(rawContent)
      ? rawContent
      : typeof rawContent === "string"
      ? Buffer.from(rawContent, "utf-8")
      : Buffer.from(rawContent);

    this.assertNoExecutableMacros(buffer, fileType);

    switch (fileType) {
      case "xlsx":
        return this.parseXlsx(buffer, suggestedTitle);
      case "csv":
        return this.parseCsv(buffer.toString("utf-8"), suggestedTitle);
      case "md":
        return this.parseMarkdown(buffer.toString("utf-8"), suggestedTitle);
      case "html":
        return this.parseHtml(buffer.toString("utf-8"), suggestedTitle);
      case "note":
      case "txt":
      default:
        return this.parsePlainText(buffer.toString("utf-8"), fileType, suggestedTitle);
    }
  }

  /**
   * Validates that uploaded binary documents do not contain forbidden macros or script payloads.
   */
  private static assertNoExecutableMacros(buffer: Buffer, fileType: DocumentFileType): void {
    if (fileType === "docx" || fileType === "xlsx" || fileType === "csv") {
      // Check for presence of VBA project binary streams inside Office OpenXML zip container
      const vbaSignature = Buffer.from("vbaProject.bin");
      const strLower = buffer.toString("utf-8", 0, Math.min(buffer.length, 4096)).toLowerCase();
      if (
        buffer.includes(vbaSignature) ||
        strLower.includes("=cmd|") ||
        strLower.includes("=dde(") ||
        strLower.includes("=cmd ")
      ) {
        throw new ParserSecurityError(
          "Security rejection: Document contains forbidden macro or formula command injection payload."
        );
      }
    }
  }

  /**
   * Real binary PDF parsing using pdf-parse engine.
   */
  private static async parsePdf(buffer: Buffer, suggestedTitle?: string): Promise<ParsedDocumentResult> {
    if (buffer.length < 5 || buffer.slice(0, 4).toString() !== "%PDF") {
      throw new ParserSecurityError("Invalid PDF file: Missing standard %PDF binary header.");
    }

    let extractedText = "";
    let pageCount = 1;

    try {
      if (pdfLib.PDFParse) {
        const instance = new pdfLib.PDFParse({ data: buffer });
        await instance.load();
        const res = await instance.getText();
        extractedText = res.text || "";
        pageCount = res.total || res.pages?.length || 1;
        await instance.destroy();
      } else if (typeof pdfLib === "function") {
        const data = await pdfLib(buffer);
        extractedText = data.text || "";
        pageCount = data.numpages || 1;
      }
    } catch (err: any) {
      throw new Error(`Failed to parse binary PDF document: ${err.message}`);
    }

    const cleanText = extractedText.replace(/\r\n/g, "\n").trim();
    const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
    let title = suggestedTitle || "PDF Document";
    if (lines.length > 0 && lines[0].length < 100) {
      title = lines[0].replace(/^#+\s*/, "");
    }

    return {
      title,
      extractedText: cleanText,
      documentMetadata: {
        format: "pdf",
        pageCount,
        characterCount: cleanText.length,
        isBinaryParsed: true
      },
      fileType: "pdf"
    };
  }

  /**
   * Real binary DOCX parsing using mammoth.
   */
  private static async parseDocx(buffer: Buffer, suggestedTitle?: string): Promise<ParsedDocumentResult> {
    // Basic zip file signature check (PK\x03\x04)
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      throw new ParserSecurityError("Invalid DOCX file: Missing ZIP container signature.");
    }

    try {
      // Convert to Markdown representation to preserve headers, bullet lists, and tables
      const mdResult = await (mammoth as any).convertToMarkdown({ buffer });
      let extractedText = mdResult.value.trim();

      if (!extractedText) {
        // Fallback to raw text extraction
        const rawResult = await mammoth.extractRawText({ buffer });
        extractedText = rawResult.value.trim();
      }

      const lines = extractedText.split("\n").map((l) => l.trim()).filter(Boolean);
      let title = suggestedTitle || "Word Document";
      if (lines.length > 0 && lines[0].length < 100) {
        title = lines[0].replace(/^#+\s*/, "");
      }

      return {
        title,
        extractedText,
        documentMetadata: {
          format: "docx",
          characterCount: extractedText.length,
          warnings: mdResult.messages || [],
          isBinaryParsed: true
        },
        fileType: "docx"
      };
    } catch (err: any) {
      if (err instanceof ParserSecurityError) throw err;
      throw new Error(`Failed to parse DOCX document: ${err.message}`);
    }
  }

  /**
   * Real binary XLSX parsing using SheetJS.
   */
  private static parseXlsx(buffer: Buffer, suggestedTitle?: string): ParsedDocumentResult {
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        return {
          title: suggestedTitle || "Spreadsheet Document",
          extractedText: "",
          documentMetadata: { format: "xlsx", sheetCount: 0, sheetNames: [] },
          fileType: "xlsx"
        };
      }

      const sheetSections: string[] = [];
      let totalRows = 0;

      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        // Convert to CSV array rows
        const csvContent = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false }).trim();
        if (csvContent) {
          const rowCount = csvContent.split("\n").length;
          totalRows += rowCount;
          sheetSections.push(`## Sheet: ${sheetName}\n${csvContent}`);
        }
      }

      const extractedText = sheetSections.join("\n\n").trim();
      const title = suggestedTitle || `Spreadsheet (${sheetNames.join(", ")})`;

      return {
        title,
        extractedText,
        documentMetadata: {
          format: "xlsx",
          sheetCount: sheetNames.length,
          sheetNames,
          totalRows,
          isTabular: true,
          isBinaryParsed: true
        },
        fileType: "xlsx"
      };
    } catch (err: any) {
      throw new Error(`Failed to parse XLSX workbook: ${err.message}`);
    }
  }

  /**
   * Robust CSV parsing using csv-parse with quotes, escapes, and multiline values.
   */
  private static parseCsv(csvText: string, suggestedTitle?: string): ParsedDocumentResult {
    const title = suggestedTitle || "Structured CSV Dataset";

    let records: string[][] = [];
    try {
      records = parseCsvSync(csvText, {
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (err: any) {
      // Fallback line parser if malformed
      records = csvText
        .split(/\r?\n/)
        .filter((l) => l.trim().length > 0)
        .map((l) => l.split(",").map((c) => c.trim().replace(/^["']|["']$/g, "")));
    }

    if (records.length === 0) {
      return {
        title,
        extractedText: "",
        documentMetadata: { format: "csv", rowCount: 0, columnCount: 0 },
        fileType: "csv"
      };
    }

    const headers = records[0];
    const formattedRows: string[] = [];
    formattedRows.push(`### Dataset: ${title}`);
    formattedRows.push(`Columns: ${headers.join(" | ")}\n`);

    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const fields = headers.map((h, idx) => `${h}: ${row[idx] ?? "N/A"}`).join(" | ");
      formattedRows.push(`Row ${i}: ${fields}`);
    }

    return {
      title,
      extractedText: formattedRows.join("\n"),
      documentMetadata: {
        format: "csv",
        rowCount: records.length - 1,
        columnCount: headers.length,
        headers
      },
      fileType: "csv"
    };
  }

  private static parseMarkdown(text: string, suggestedTitle?: string): ParsedDocumentResult {
    let title = suggestedTitle || "Markdown Document";
    const titleMatch = text.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    let cleanText = text;
    const frontmatter: Record<string, string> = {};
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

    let text = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, "");

    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
    text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<[^>]+>/g, "");

    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

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

  private static parsePlainText(
    content: string,
    fileType: DocumentFileType,
    suggestedTitle?: string
  ): ParsedDocumentResult {
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
