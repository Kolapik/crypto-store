import {
  bestModelFromTitle,
  categorizeWatch,
  compactText,
  findKnownBrand,
  inferAvailability,
  inferCondition,
  inferHype,
  parseCurrency,
  parsePrice,
  parseReference,
  parseYear,
  tagsForDraft,
} from "./normalizer";
import type { ParsedWatchDraft } from "./types";

function meta(metaTags: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = compactText(metaTags[key]);
    if (value) return value;
  }
  return undefined;
}

export function parseMetaProduct(metaTags: Record<string, string>): Partial<ParsedWatchDraft> {
  const title = meta(metaTags, "og:title", "twitter:title", "title");
  const description = meta(metaTags, "og:description", "twitter:description", "description");
  const combined = `${title ?? ""} ${description ?? ""}`;
  const brand = meta(metaTags, "product:brand", "og:brand") ?? findKnownBrand(combined);
  const reference = meta(metaTags, "product:retailer_item_id", "product:sku") ?? parseReference(combined);
  const model = bestModelFromTitle(title, brand, reference);
  const priceText = meta(metaTags, "product:price:amount", "price", "twitter:data1");
  const currency = meta(metaTags, "product:price:currency", "currency") ?? parseCurrency(combined);
  const availability = inferAvailability(meta(metaTags, "product:availability") ?? combined);
  const condition = inferCondition(combined);
  const year = parseYear(combined);
  const hype = inferHype(brand, model);
  const category = categorizeWatch(brand);
  const image = meta(metaTags, "og:image:secure_url", "og:image", "twitter:image");

  return {
    title,
    brand,
    model,
    reference,
    year,
    condition,
    publicPrice: parsePrice(priceText),
    currency,
    description,
    availability,
    category,
    hype,
    newArrival: true,
    featured: hype,
    publicImages: image ? [image] : undefined,
    tags: tagsForDraft({ brand, model, category, hype, newArrival: true }),
  };
}
