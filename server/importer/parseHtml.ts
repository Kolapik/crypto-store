import { load } from "cheerio";
import { parseJsonLdProduct } from "./genericJsonLdParser";
import { parseMetaProduct } from "./genericMetaParser";
import { parseHeuristicProduct } from "./heuristicParser";
import { asStringArray, compactText } from "./normalizer";
import type { ParsedWatchDraft, RawImportData } from "./types";

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function uniqueStrings(values: unknown[], limit = 20) {
  return Array.from(
    new Set(
      values
        .flatMap(asStringArray)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function parseSrcset(srcset: string) {
  return srcset
    .split(",")
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/, 2);
      const width = descriptor?.match(/^(\d+)w$/i)?.[1];
      const density = descriptor?.match(/^(\d+(?:\.\d+)?)x$/i)?.[1];
      const score = width ? Number(width) : density ? Number(density) * 1_000 : 1;
      return { url, score: Number.isFinite(score) ? score : 1 };
    })
    .filter((candidate) => candidate.url);
}

function bestFromSrcset(srcset?: string) {
  if (!srcset) return undefined;
  return parseSrcset(srcset).sort((a, b) => b.score - a.score)[0]?.url;
}

function imageUrlScore(value: string) {
  const lower = value.toLowerCase();
  if (/(logo|favicon|icon|sprite|placeholder|spinner|avatar|payment|badge)/.test(lower)) return -10_000;

  let score = 0;
  if (/\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(value)) score += 100;
  if (/(product|watch|catalog|detail|gallery|media|large|zoom|full)/.test(lower)) score += 250;
  if (/(thumb|thumbnail|small|tiny|crop)/.test(lower)) score -= 200;

  const sizeHints = Array.from(value.matchAll(/(?:^|[^\d])([1-9]\d{2,4})(?:x|w|_|-|\.|%2C)/gi))
    .map((match) => Number(match[1]))
    .filter((number) => Number.isFinite(number));
  if (sizeHints.length) score += Math.max(...sizeHints);

  return score;
}

function bestImageUrls(values: unknown[], limit = 20) {
  const seen = new Set<string>();
  return values
    .flatMap(asStringArray)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return imageUrlScore(value) > -5_000;
    })
    .sort((a, b) => imageUrlScore(b) - imageUrlScore(a))
    .slice(0, limit);
}

function mergeDrafts(...drafts: Partial<ParsedWatchDraft>[]): Partial<ParsedWatchDraft> {
  const merged: Partial<ParsedWatchDraft> = {};
  const publicImages: string[] = [];
  const tags: string[] = [];

  for (const draft of drafts) {
    for (const [key, value] of Object.entries(draft) as [keyof ParsedWatchDraft, unknown][]) {
      if (key === "warnings" || key === "raw") continue;
      if (key === "publicImages") {
        publicImages.push(...asStringArray(value));
        continue;
      }
      if (key === "tags") {
        tags.push(...asStringArray(value));
        continue;
      }
      if (merged[key] === undefined && value !== undefined && value !== "") {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  }

  if (publicImages.length) merged.publicImages = bestImageUrls(publicImages, 16);
  if (tags.length) merged.tags = uniqueStrings(tags, 12);
  return merged;
}

export function parseGenericHtml(input: {
  html: string;
  pageUrl: URL;
  supplierDomain: string;
  manualText?: string;
}): ParsedWatchDraft {
  const $ = load(input.html);
  $("script:not([type*='ld+json']), style, noscript, svg").remove();

  const jsonLd = $("script[type*='ld+json']")
    .toArray()
    .map((element) => safeJsonParse($(element).contents().text()))
    .filter((value): value is unknown => value !== null);

  const metaTags: Record<string, string> = {};
  $("title").each((_, element) => {
    const value = compactText($(element).text());
    if (value) metaTags.title = value;
  });
  $("meta").each((_, element) => {
    const key = compactText($(element).attr("property")) ?? compactText($(element).attr("name"));
    const content = compactText($(element).attr("content"));
    if (key && content && !metaTags[key]) metaTags[key] = content;
  });

  const selectors: Record<string, string> = {};
  const selectorMap: Record<string, string> = {
    h1: "h1",
    price: "[itemprop='price'], .price, [class*='price' i]",
    reference: "[class*='reference' i], [class*='ref' i], [data-testid*='reference' i]",
    condition: "[class*='condition' i], [data-testid*='condition' i]",
    specs: "[class*='spec' i], [class*='detail' i], [class*='product' i]",
  };
  for (const [key, selector] of Object.entries(selectorMap)) {
    const value = compactText(
      $(selector)
        .slice(0, 6)
        .map((_, element) => $(element).text())
        .toArray()
        .join(" "),
    );
    if (value) selectors[key] = value.slice(0, 2_000);
  }

  const imageUrls = bestImageUrls([
    metaTags["og:image:secure_url"],
    metaTags["og:image"],
    metaTags["twitter:image"],
    ...$("img, source")
      .slice(0, 80)
      .map((_, element) => {
        const node = $(element);
        return (
          bestFromSrcset(node.attr("srcset")) ??
          node.attr("data-zoom-image") ??
          node.attr("data-large-image") ??
          node.attr("data-original") ??
          node.attr("data-src") ??
          node.attr("src")
        );
      })
      .toArray(),
  ], 24);

  const textSample = compactText($("body").text())?.slice(0, 12_000) ?? "";
  const manualText = compactText(input.manualText);
  const fullText = [textSample, manualText].filter(Boolean).join(" ");
  const fromJsonLd = parseJsonLdProduct(jsonLd);
  const fromMeta = parseMetaProduct(metaTags);
  const fromHeuristic = parseHeuristicProduct({
    title: metaTags["og:title"] ?? metaTags.title,
    selectors,
    text: fullText,
  });

  const raw: RawImportData = {
    jsonLd,
    meta: metaTags,
    selectors,
    textSample,
    imageUrls,
    manualText,
  };

  const merged = mergeDrafts(fromJsonLd, fromMeta, fromHeuristic);
  const warnings: string[] = [];
  if (!merged.brand) warnings.push("Brand was not confidently extracted.");
  if (!merged.model) warnings.push("Model was not confidently extracted.");
  if (!merged.reference) warnings.push("Reference was not found.");
  if (!merged.publicPrice) warnings.push("Public price was not found.");
  if (!merged.publicImages?.length && imageUrls.length) merged.publicImages = imageUrls;
  if (!merged.publicImages?.length) warnings.push("No usable product images were found.");

  return {
    ...merged,
    supplierDomain: input.supplierDomain,
    supplierUrl: input.pageUrl.origin,
    sourceUrl: input.pageUrl.toString(),
    warnings,
    raw,
  };
}
