/**
 * Turn a pasted product link into a name and a line of "how to use".
 *
 * Order of attempts, cheapest first:
 *   1. the page's own metadata (og:title / og:description / <title> / meta
 *      description) — good enough for most retailer pages;
 *   2. when COHERE_API_KEY is set, ask the model to read the page text and
 *      pull out the product name and directions;
 *   3. otherwise return nothing and let the patient type it in.
 *
 * Server-only. The fetch is bounded (timeout, size) and refuses private and
 * loopback hosts so a pasted link cannot be used to probe the network.
 */

export type ProductExtraction = {
  name: string | null;
  howTo: string | null;
  /** How the fields were filled; "manual" means nothing usable was found. */
  source: "link" | "ai" | "manual";
};

const MAX_BYTES = 400_000;
const DEFAULT_MODEL = "command-a-plus-05-2026";

function isPrivateHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(h)) {
    const [a, b] = h.split(".").map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h === "::1" || h.startsWith("[::1]") || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  return false;
}

/** Accepts only public http(s) URLs. Throws a user-facing message otherwise. */
export function parseProductUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That does not look like a web address. Paste the full link, starting with https://");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links are supported.");
  if (isPrivateHost(url.hostname)) throw new Error("That link is not reachable from here.");
  return url;
}

function decodeEntities(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m?.[1]?.trim()) return decodeEntities(m[1]);
    }
  }
  return null;
}

/** Strip a retailer's " | Brand" or " – Shop" tail from a page title. */
function cleanTitle(title: string) {
  return title.split(/\s+[|–—-]\s+/)[0]?.trim() || title.trim();
}

function visibleText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).slice(0, 6000);
}

async function fetchPage(url: URL): Promise<string> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AetheriaPortal/1.0; +https://aetheria.example)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`The page could not be fetched (${response.status}).`);
  const type = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(type)) throw new Error("That link is not a web page.");
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  void reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function askModel(pageText: string, url: string): Promise<ProductExtraction | null> {
  const key = process.env["COHERE_API_KEY"]?.trim();
  if (!key) return null;
  try {
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: { Authorization: `bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env["COHERE_MODEL"]?.trim() || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You read skincare product pages. Reply with JSON only: {\"name\": string, \"howTo\": string}. " +
              "name is the product's full name including brand; howTo is one or two plain sentences of directions " +
              "for use taken from the page. If the page is not a product, reply {\"name\": null, \"howTo\": null}.",
          },
          { role: "user", content: `URL: ${url}\n\nPage text:\n${pageText}` },
        ],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const payload: any = await response.json();
    const text = (payload?.message?.content ?? [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text)
      .join("")
      .trim();
    const parsed = JSON.parse(text);
    const name = typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 200) : null;
    const howTo = typeof parsed?.howTo === "string" && parsed.howTo.trim() ? parsed.howTo.trim().slice(0, 600) : null;
    if (!name) return null;
    return { name, howTo, source: "ai" };
  } catch (error) {
    console.warn(`[product-link] model call failed: ${(error as Error).message}`);
    return null;
  }
}

export async function extractProductFromUrl(raw: string): Promise<ProductExtraction> {
  const url = parseProductUrl(raw);
  let html: string;
  try {
    html = await fetchPage(url);
  } catch (error) {
    console.warn(`[product-link] fetch failed: ${(error as Error).message}`);
    return { name: null, howTo: null, source: "manual" };
  }

  const ogTitle = metaContent(html, ["og:title", "twitter:title"]);
  const htmlTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const name = cleanTitle(ogTitle ?? (htmlTitle ? decodeEntities(htmlTitle) : "")) || null;
  const description = metaContent(html, ["og:description", "twitter:description", "description"]);

  // A description that reads like directions is good enough on its own.
  if (name && description && /\b(apply|use|massage|cleanse|pat|smooth|dispense|morning|evening|daily)\b/i.test(description)) {
    return { name: name.slice(0, 200), howTo: description.slice(0, 600), source: "link" };
  }

  const fromModel = await askModel(visibleText(html), url.toString());
  if (fromModel) return fromModel;

  if (name) return { name: name.slice(0, 200), howTo: description?.slice(0, 600) ?? null, source: "link" };
  return { name: null, howTo: null, source: "manual" };
}
