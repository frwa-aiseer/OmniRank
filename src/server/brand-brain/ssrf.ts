import dns from "dns/promises";
import net from "net";

export class SSRFProtectionError extends Error {
  constructor(message: string) {
    super(`[SSRF Protection] ${message}`);
    this.name = "SSRFProtectionError";
  }
}

/**
 * Checks whether an IPv4 or IPv6 address is private, loopback, link-local, or cloud metadata.
 */
export function isRestrictedIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    const v4 = ip.replace(/^::ffff:/, "");
    if (net.isIPv4(v4)) return isRestrictedIp(v4);
  }

  // IPv4 Check
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;
    // 10.0.0.0/8 (Private)
    if (a === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (Link-local, including Cloud Metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Broadcast
    if (ip === "255.255.255.255") return true;

    return false;
  }

  // IPv6 Check
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
    // Unspecified ::
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;
    // Unique Local Addresses (fc00::/7, fd00::/8)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    // Link-local (fe80::/10)
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;

    return false;
  }

  return true; // Malformed IP treated as restricted
}

/**
 * Validates a target URL against SSRF attack vectors.
 */
export async function validateSafeUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    throw new SSRFProtectionError(`Invalid URL format: ${rawUrl}`);
  }

  // Enforce HTTP / HTTPS protocol only
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SSRFProtectionError(`Protocol not permitted: ${parsed.protocol} (only HTTP and HTTPS supported)`);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, local aliases, and common cloud metadata endpoints
  const blockedHostnames = [
    "localhost",
    "localhost.localdomain",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "169.254.169.254"
  ];

  if (blockedHostnames.includes(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new SSRFProtectionError(`Host is blocked for SSRF protection: ${hostname}`);
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isRestrictedIp(hostname)) {
      throw new SSRFProtectionError(`Target IP ${hostname} is in a restricted or private address range.`);
    }
    return parsed;
  }

  // Resolve DNS and verify all addresses
  try {
    const lookupResults = await dns.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new SSRFProtectionError(`Failed to resolve host ${hostname}`);
    }

    for (const record of lookupResults) {
      if (isRestrictedIp(record.address)) {
        throw new SSRFProtectionError(
          `Host ${hostname} resolves to restricted/private address: ${record.address}`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof SSRFProtectionError) throw err;
    throw new SSRFProtectionError(`DNS resolution failure for ${hostname}: ${err.message}`);
  }

  return parsed;
}

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  bodyText: string;
  title: string;
  cleanText: string;
  internalLinks: string[];
}

/**
 * Safely fetches a web page with SSRF protection, strict redirect verification,
 * response size limits, and HTML boilerplate removal.
 */
export async function safeFetchWebsite(
  initialUrl: string,
  options: {
    maxRedirects?: number;
    timeoutMs?: number;
    maxSizeBytes?: number;
  } = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 5;
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxSizeBytes = options.maxSizeBytes ?? 5 * 1024 * 1024; // 5 MB

  let currentUrl = initialUrl;
  let redirectCount = 0;
  let finalResponse: Response | null = null;

  while (redirectCount <= maxRedirects) {
    const validatedUrl = await validateSafeUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      finalResponse = await fetch(validatedUrl.toString(), {
        method: "GET",
        headers: {
          "User-Agent": "OmniRank-BrandBrain-Bot/1.0 (+https://omnirank.ai/bot; bot@omnirank.ai)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8"
        },
        redirect: "manual",
        signal: controller.signal
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new SSRFProtectionError(`Fetch request timed out after ${timeoutMs}ms: ${currentUrl}`);
      }
      throw new SSRFProtectionError(`Network fetch failure for ${currentUrl}: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    // Handle Redirects
    if ([301, 302, 303, 307, 308].includes(finalResponse.status)) {
      const location = finalResponse.headers.get("location");
      if (!location) {
        throw new SSRFProtectionError(`Received redirect status ${finalResponse.status} with missing Location header`);
      }
      redirectCount++;
      if (redirectCount > maxRedirects) {
        throw new SSRFProtectionError(`Too many redirects (exceeded limit of ${maxRedirects})`);
      }
      // Resolve relative location
      const nextUrl = new URL(location, validatedUrl).toString();
      currentUrl = nextUrl;
      continue;
    }

    break;
  }

  if (!finalResponse) {
    throw new SSRFProtectionError("No response received from target URL");
  }

  if (!finalResponse.ok) {
    throw new Error(`Target returned HTTP status ${finalResponse.status} ${finalResponse.statusText}`);
  }

  const contentType = finalResponse.headers.get("content-type") || "text/html";
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml") &&
    !contentType.includes("text/plain")
  ) {
    throw new SSRFProtectionError(
      `Unsupported Content-Type: ${contentType}. Expected text/html or text/plain.`
    );
  }

  // Check Content-Length if provided
  const contentLength = finalResponse.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
    throw new SSRFProtectionError(`Content-Length ${contentLength} exceeds maximum allowed size of ${maxSizeBytes} bytes`);
  }

  // Read response with size cap
  const buffer = await finalResponse.arrayBuffer();
  if (buffer.byteLength > maxSizeBytes) {
    throw new SSRFProtectionError(`Downloaded response (${buffer.byteLength} bytes) exceeds maximum allowed size of ${maxSizeBytes} bytes`);
  }

  const rawText = new TextDecoder("utf-8").decode(buffer);

  // Extract content & title
  const { title, cleanText, internalLinks } = extractMeaningfulWebContent(rawText, currentUrl);

  return {
    url: initialUrl,
    finalUrl: currentUrl,
    status: finalResponse.status,
    contentType,
    bodyText: rawText,
    title,
    cleanText,
    internalLinks
  };
}

/**
 * Extracts page title, headings, and clean body text from HTML while removing boilerplate.
 */
export function extractMeaningfulWebContent(
  html: string,
  baseUrl: string
): { title: string; cleanText: string; internalLinks: string[] } {
  let title = "Web Page";
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/&[a-z]+;/gi, " ").trim();
  } else {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]+>/g, "").trim();
    }
  }

  // Extract internal links
  const internalLinks: string[] = [];
  try {
    const origin = new URL(baseUrl).origin;
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.origin === origin && !internalLinks.includes(resolved.toString())) {
          internalLinks.push(resolved.toString());
        }
      } catch {
        // ignore invalid hrefs
      }
    }
  } catch {
    // ignore
  }

  // Remove boilerplate & intrusive elements
  let processed = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?>[\s\S]*?<\/aside>/gi, "")
    .replace(/<noscript[\s\S]*?>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?>[\s\S]*?<\/svg>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "");

  // Format headings into markdown
  processed = processed
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  // Decode standard HTML entities
  processed = processed
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean excess whitespace
  processed = processed
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title,
    cleanText: processed,
    internalLinks: internalLinks.slice(0, 50)
  };
}
