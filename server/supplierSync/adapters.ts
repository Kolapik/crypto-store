import { load } from "cheerio";
import { parseCurrency, parsePrice } from "../importer/normalizer";
import type { RawSupplierImage, RawSupplierProduct, SupplierAdapter, SupplierConfig } from "./types";
import { RawSupplierProductSchema } from "./types";

function compactText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asStringArray);
  const text = compactText(value);
  return text ? [text] : [];
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const object = objectValue(value);
  if (!object) return [];
  return [object, ...flattenJsonLd(object["@graph"])];
}

function typeNames(object: Record<string, unknown>) {
  const value = object["@type"];
  return (Array.isArray(value) ? value : [value])
    .map((item) => compactText(item)?.toLowerCase())
    .filter((item): item is string => Boolean(item));
}

function isProductObject(object: Record<string, unknown>) {
  const types = typeNames(object);
  return types.includes("product") || types.includes("productgroup");
}

function brandName(value: unknown) {
  if (typeof value === "string") return compactText(value);
  return compactText(objectValue(value)?.name);
}

function firstOffer(value: unknown) {
  if (Array.isArray(value)) return objectValue(value[0]);
  return objectValue(value);
}

function availability(value: unknown): RawSupplierProduct["availability"] {
  const lower = compactText(value)?.toLowerCase() ?? "";
  if (lower.includes("instock") || lower.includes("in stock") || lower.includes("available")) return "in_stock";
  if (lower.includes("outofstock") || lower.includes("out of stock") || lower.includes("soldout")) return "out_of_stock";
  if (lower.includes("preorder")) return "preorder";
  if (lower.includes("backorder")) return "backorder";
  return "unknown";
}

function imageUrlScore(value: string) {
  const lower = value.toLowerCase();
  if (/(logo|favicon|icon|sprite|placeholder|spinner|avatar|payment|badge)/.test(lower)) return -10_000;
  let score = 0;
  if (/\.(jpe?g|png|webp|avif)(\?|#|$)/i.test(value)) score += 100;
  if (/(product|watch|catalog|detail|gallery|media|large|zoom|full|original)/.test(lower)) score += 250;
  if (/(thumb|thumbnail|small|tiny|crop)/.test(lower)) score -= 200;
  const sizeHints = Array.from(value.matchAll(/(?:^|[^\d])([1-9]\d{2,4})(?:x|w|_|-|\.|%2C)/gi))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (sizeHints.length) score += Math.max(...sizeHints);
  return score;
}

export function parseSrcset(srcset: string) {
  return srcset
    .split(",")
    .map((part) => {
      const [url, descriptor] = part.trim().split(/\s+/, 2);
      const width = descriptor?.match(/^(\d+)w$/i)?.[1];
      const density = descriptor?.match(/^(\d+(?:\.\d+)?)x$/i)?.[1];
      const score = width ? Number(width) : density ? Number(density) * 400 : imageUrlScore(url);
      return { url, score: Number.isFinite(score) ? score : 1 };
    })
    .filter((candidate) => candidate.url)
    .sort((a, b) => b.score - a.score);
}

function imageCandidates(values: unknown[], baseUrl: URL, limit = 24): RawSupplierImage[] {
  const seen = new Set<string>();
  return values
    .flatMap(asStringArray)
    .map((value) => {
      try {
        return new URL(value, baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return imageUrlScore(value) > -5_000;
    })
    .map((url) => ({ url, score: imageUrlScore(url) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

function breadcrumbs(objects: Record<string, unknown>[]) {
  for (const object of objects) {
    if (!typeNames(object).includes("breadcrumblist")) continue;
    const elements = Array.isArray(object.itemListElement) ? object.itemListElement : [];
    const names = elements
      .map((item) => objectValue(item))
      .map((item) => compactText(objectValue(item?.item)?.name) ?? compactText(item?.name))
      .filter((name): name is string => Boolean(name));
    if (names.length) return names;
  }
  return [];
}

function productScore(product: Record<string, unknown>, pageUrl: URL, h1?: string) {
  const productUrl = compactText(product.url);
  const name = compactText(product.name);
  let score = 0;
  if (firstOffer(product.offers)) score += 10;
  if (productUrl) {
    try {
      const normalizedProduct = new URL(productUrl, pageUrl).pathname.replace(/\/+$/, "");
      const normalizedPage = pageUrl.pathname.replace(/\/+$/, "");
      if (normalizedProduct === normalizedPage) score += 40;
    } catch {
      score += 0;
    }
  }
  if (h1 && name && h1.toLowerCase().includes(name.toLowerCase().slice(0, 20))) score += 20;
  if (Array.isArray(product.image) || compactText(product.image)) score += 5;
  return score;
}

function variantFromProduct(product: Record<string, unknown>, index: number) {
  const offer = firstOffer(product.offers);
  const title = compactText(product.name);
  const sku = compactText(product.sku) ?? compactText(product.mpn);
  const priceText = compactText(offer?.price) ?? compactText(offer?.lowPrice);
  return {
    sourceVariantId: sku ?? `variant-${index}`,
    sku,
    title,
    supplierPrice: parsePrice(priceText),
    currency: compactText(offer?.priceCurrency),
    availability: availability(offer?.availability),
    imageUrl: asStringArray(product.image)[0],
    options: {},
  };
}

export const GenericStructuredDataAdapter: SupplierAdapter = {
  name: "generic_structured_data",
  canHandle({ html }) {
    return html.includes("ld+json");
  },
  async extractProduct({ html, pageUrl }) {
    const $ = load(html);
    const h1 = compactText($("h1").first().text());
    const jsonLd = $("script[type*='ld+json']")
      .toArray()
      .map((element) => safeJsonParse($(element).contents().text()))
      .filter((value): value is unknown => value !== null);
    const objects = jsonLd.flatMap(flattenJsonLd);
    const products = objects.filter(isProductObject);
    const product = products.sort((a, b) => productScore(b, pageUrl, h1) - productScore(a, pageUrl, h1))[0];
    if (!product) return null;

    const offer = firstOffer(product.offers);
    const variants = asStringArray(product.hasVariant).length
      ? asStringArray(product.hasVariant).map((title, index) => ({
          sourceVariantId: `variant-${index}`,
          title,
          options: {},
          availability: "unknown" as const,
        }))
      : (Array.isArray(product.hasVariant) ? product.hasVariant : [])
          .map(objectValue)
          .filter((item): item is Record<string, unknown> => Boolean(item))
          .map(variantFromProduct);

    const title = compactText(product.name) ?? h1;
    if (!title) return null;
    const priceText = compactText(offer?.price) ?? compactText(offer?.lowPrice) ?? compactText(offer?.highPrice);
    const parsed = RawSupplierProductSchema.safeParse({
      canonicalUrl: new URL(compactText(product.url) ?? pageUrl.toString(), pageUrl).toString(),
      sourceProductId: compactText(product.productID) ?? compactText(product["@id"]),
      sku: compactText(product.sku) ?? compactText(product.mpn),
      brand: brandName(product.brand),
      title,
      description: compactText(product.description),
      category: compactText(product.category),
      breadcrumbs: breadcrumbs(objects),
      supplierPrice: parsePrice(priceText),
      currency: compactText(offer?.priceCurrency) ?? parseCurrency(`${priceText ?? ""} ${html.slice(0, 5000)}`),
      availability: availability(offer?.availability),
      images: imageCandidates([product.image], pageUrl),
      variants,
      confidence: 0.86,
      fieldProvenance: {
        title: "json_ld",
        price: "json_ld",
        images: "json_ld",
      },
      raw: { jsonLdProducts: products.slice(0, 5) },
    });
    return parsed.success ? parsed.data : null;
  },
};

export const GenericHtmlAdapter: SupplierAdapter = {
  name: "generic_html",
  canHandle() {
    return true;
  },
  async extractProduct({ html, pageUrl }) {
    const $ = load(html);
    $("script:not([type*='ld+json']), style, noscript, svg").remove();
    const meta: Record<string, string> = {};
    $("title").each((_, element) => {
      const value = compactText($(element).text());
      if (value) meta.title = value;
    });
    $("meta").each((_, element) => {
      const key = compactText($(element).attr("property")) ?? compactText($(element).attr("name"));
      const content = compactText($(element).attr("content"));
      if (key && content && !meta[key]) meta[key] = content;
    });
    const title = compactText($("h1").first().text()) ?? meta["og:title"] ?? meta.title;
    if (!title) return null;
    const bodyText = compactText($("body").text())?.slice(0, 20_000) ?? "";
    const priceText =
      compactText($("[itemprop='price'], [class*='price' i], [data-testid*='price' i]").first().text()) ??
      compactText(meta["product:price:amount"]) ??
      bodyText.match(/(?:CHF|EUR|USD|GBP|€|\$|£)\s?[\d'.,]+|[\d'.,]+\s?(?:CHF|EUR|USD|GBP)/i)?.[0];
    const lazyImages = $("img, source")
      .slice(0, 120)
      .map((_, element) => {
        const node = $(element);
        const srcset = node.attr("srcset") ?? node.attr("data-srcset");
        return (
          (srcset ? parseSrcset(srcset)[0]?.url : undefined) ??
          node.attr("data-zoom-image") ??
          node.attr("data-large-image") ??
          node.attr("data-original") ??
          node.attr("data-lazy-src") ??
          node.attr("data-src") ??
          node.attr("src")
        );
      })
      .toArray();

    const parsed = RawSupplierProductSchema.safeParse({
      canonicalUrl: $("link[rel='canonical']").attr("href")
        ? new URL(String($("link[rel='canonical']").attr("href")), pageUrl).toString()
        : pageUrl.toString(),
      sku: compactText(meta["product:retailer_item_id"]) ?? compactText(meta["product:sku"]),
      brand: compactText(meta["product:brand"]) ?? compactText(meta["og:brand"]),
      title,
      description: compactText(meta["og:description"]) ?? compactText(meta.description),
      category: compactText(meta["product:category"]),
      breadcrumbs: $("[itemtype*='BreadcrumbList'] [itemprop='name'], nav[aria-label*='breadcrumb' i] a")
        .slice(0, 8)
        .map((_, element) => compactText($(element).text()))
        .toArray()
        .filter(Boolean),
      supplierPrice: parsePrice(priceText),
      currency: compactText(meta["product:price:currency"]) ?? parseCurrency(`${priceText ?? ""} ${bodyText}`),
      availability: availability(meta["product:availability"] ?? bodyText),
      images: imageCandidates(
        [
          meta["og:image:secure_url"],
          meta["og:image"],
          meta["twitter:image"],
          ...lazyImages,
        ],
        pageUrl,
      ),
      confidence: 0.58,
      fieldProvenance: {
        title: "generic_selector",
        price: "generic_selector",
        images: "generic_selector",
      },
      raw: {
        meta,
        textSample: bodyText.slice(0, 2500),
      },
    });
    return parsed.success ? parsed.data : null;
  },
};

export const GenericJavaScriptAdapter: SupplierAdapter = {
  name: "generic_javascript",
  async canHandle({ html }) {
    const bodyText = load(html)("body").text().replace(/\s+/g, " ").trim();
    return bodyText.length < 300 || /enable javascript|requires javascript/i.test(bodyText);
  },
  async extractProduct({ pageUrl, supplier }) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        userAgent: "HelveticReserveSupplierSync/1.0 (+https://helvetic-reserve.com)",
      });
      await page.goto(pageUrl.toString(), { waitUntil: "networkidle", timeout: 20_000 });
      const renderedHtml = await page.content();
      return (
        (await GenericStructuredDataAdapter.extractProduct({ html: renderedHtml, pageUrl, supplier })) ??
        (await GenericHtmlAdapter.extractProduct({ html: renderedHtml, pageUrl, supplier }))
      );
    } finally {
      await browser.close();
    }
  },
};

const DEFAULT_ADAPTERS = [
  GenericStructuredDataAdapter,
  GenericHtmlAdapter,
  GenericJavaScriptAdapter,
];

export async function extractWithAdapters(input: {
  html: string;
  pageUrl: URL;
  supplier: SupplierConfig;
  adapters?: SupplierAdapter[];
}) {
  const adapters = input.adapters ?? DEFAULT_ADAPTERS;
  const diagnostics: string[] = [];

  for (const adapter of adapters) {
    try {
      if (!(await adapter.canHandle(input))) continue;
      const product = await adapter.extractProduct(input);
      if (product) return { product, adapterName: adapter.name, diagnostics };
      diagnostics.push(`${adapter.name}: no product extracted`);
    } catch (error) {
      diagnostics.push(`${adapter.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { product: null, adapterName: null, diagnostics };
}
