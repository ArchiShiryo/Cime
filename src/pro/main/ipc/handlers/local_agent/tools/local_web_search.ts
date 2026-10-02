/**
 * Keyless web search for the agent: DuckDuckGo's HTML endpoint by default (the
 * approach used by the open-source duckduckgo MCP servers), or a SearXNG
 * instance when the user configures one (more robust for a whole classroom).
 */
import { parseHTML } from "linkedom";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";
import { fetchPublicPage } from "./local_web";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 8;

/** DuckDuckGo wraps links as //duckduckgo.com/l/?uddg=<encoded target>. */
export function unwrapDuckDuckGoUrl(href: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    if (target) return decodeURIComponent(target);
    if (url.hostname.endsWith("duckduckgo.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function parseDuckDuckGoResults(html: string): SearchResult[] {
  const { document } = parseHTML(html);
  const results: SearchResult[] = [];
  for (const node of Array.from(document.querySelectorAll(".result"))) {
    if (node.classList.contains("result--ad")) continue;
    const link = node.querySelector("a.result__a");
    const url = unwrapDuckDuckGoUrl(link?.getAttribute("href") ?? "");
    const title = link?.textContent?.replace(/\s+/g, " ").trim();
    if (!url || !title || !/^https?:/i.test(url)) continue;
    const snippet =
      node
        .querySelector(".result__snippet")
        ?.textContent?.replace(/\s+/g, " ")
        .trim() ?? "";
    results.push({ title, url, snippet });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

function looksLikeBotCheck(status: number, html: string): boolean {
  return (
    status === 202 ||
    status === 429 ||
    /bots use DuckDuckGo too|anomaly-modal|Please complete the following challenge/i.test(
      html,
    )
  );
}

/** Bing wraps result links as bing.com/ck/a?...&u=a1<base64url of the target>. */
export function unwrapBingUrl(href: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, "https://www.bing.com");
    if (!url.hostname.endsWith("bing.com")) return url.toString();
    const encoded = url.searchParams.get("u");
    if (encoded?.startsWith("a1")) {
      const decoded = Buffer.from(
        encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8");
      return /^https?:\/\//i.test(decoded) ? decoded : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseBingResults(html: string): SearchResult[] {
  const { document } = parseHTML(html);
  const results: SearchResult[] = [];
  for (const node of Array.from(document.querySelectorAll("li.b_algo"))) {
    const link = node.querySelector("h2 a");
    const url = unwrapBingUrl(link?.getAttribute("href") ?? "");
    const title = link?.textContent?.replace(/\s+/g, " ").trim();
    if (!url || !title) continue;
    const snippet =
      node
        .querySelector(".b_caption p, p.b_lineclamp2, .b_lineclamp2")
        ?.textContent?.replace(/\s+/g, " ")
        .trim() ?? "";
    results.push({ title, url, snippet });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

async function searchBing(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const page = await fetchPublicPage(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (page.status >= 400) {
    throw new DyadError(
      `The search engine answered with HTTP ${page.status}`,
      DyadErrorKind.External,
    );
  }
  return parseBingResults(page.text);
}

async function searchDuckDuckGo(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const page = await fetchPublicPage("https://html.duckduckgo.com/html/", {
    signal,
    method: "POST",
    body: new URLSearchParams({ q: query, kl: "wt-wt" }).toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://html.duckduckgo.com/",
    },
  });
  if (looksLikeBotCheck(page.status, page.text)) {
    throw new DyadError(
      "DuckDuckGo is temporarily limiting searches from this connection. Wait a minute and retry, or ask your administrator to configure a SearXNG search server in Settings.",
      DyadErrorKind.RateLimited,
    );
  }
  if (page.status >= 400) {
    throw new DyadError(
      `The search engine answered with HTTP ${page.status}`,
      DyadErrorKind.External,
    );
  }
  return parseDuckDuckGoResults(page.text);
}

export function parseSearxngResults(json: unknown): SearchResult[] {
  const rows = (json as { results?: unknown })?.results;
  if (!Array.isArray(rows)) return [];
  const results: SearchResult[] = [];
  for (const row of rows) {
    const { title, url, content } = (row ?? {}) as Record<string, unknown>;
    if (
      typeof title === "string" &&
      typeof url === "string" &&
      /^https?:/i.test(url)
    ) {
      results.push({
        title: title.replace(/\s+/g, " ").trim(),
        url,
        snippet:
          typeof content === "string"
            ? content.replace(/\s+/g, " ").trim()
            : "",
      });
    }
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

async function searchSearxng(
  baseUrl: string,
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  const endpoint = new URL(
    "search",
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
  );
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  // The instance is configured by the administrator, so private addresses are fine.
  const page = await fetchPublicPage(endpoint.toString(), {
    signal,
    allowPrivate: true,
  });
  if (page.status >= 400) {
    throw new DyadError(
      `The SearXNG server answered with HTTP ${page.status} (JSON output must be enabled on it)`,
      DyadErrorKind.External,
    );
  }
  try {
    return parseSearxngResults(JSON.parse(page.text));
  } catch {
    throw new DyadError(
      "The SearXNG server did not return JSON (enable the json format in its settings)",
      DyadErrorKind.External,
    );
  }
}

export function formatSearchResults(
  query: string,
  results: SearchResult[],
): string {
  if (results.length === 0) return `No web results for "${query}".`;
  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.title}\n   ${result.url}${result.snippet ? `\n   ${result.snippet}` : ""}`,
    )
    .join("\n\n");
}

export async function searchWeb(
  query: string,
  options: { searxngUrl?: string; signal?: AbortSignal } = {},
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new DyadError("The search query is empty", DyadErrorKind.Validation);
  }
  if (options.searxngUrl) {
    return searchSearxng(options.searxngUrl, trimmed, options.signal);
  }
  // No key needed: DuckDuckGo first, Bing when DuckDuckGo limits the
  // connection (common from shared school or cloud addresses) or finds nothing.
  let firstError: unknown;
  try {
    const results = await searchDuckDuckGo(trimmed, options.signal);
    if (results.length > 0) return results;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    firstError = error;
  }
  try {
    return await searchBing(trimmed, options.signal);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw firstError ?? error;
  }
}
