import {
  asStringArray,
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  const object = objectValue(value);
  if (!object) return [];
  const graph = object["@graph"];
  return [object, ...flattenJsonLd(graph)];
}

function hasProductType(object: Record<string, unknown>) {
  const typeValue = object["@type"];
  const types = Array.isArray(typeValue) ? typeValue : [typeValue];
  return types.some((item) => compactText(item)?.toLowerCase() === "product");
}

function brandName(value: unknown) {
  if (typeof value === "string") return compactText(value);
  const object = objectValue(value);
  return compactText(object?.name);
}

function firstOffer(object: Record<string, unknown>) {
  const offerValue = object.offers;
  if (Array.isArray(offerValue)) return objectValue(offerValue[0]);
  return objectValue(offerValue);
}

export function parseJsonLdProduct(jsonLd: unknown[]): Partial<ParsedWatchDraft> {
  const products = jsonLd.flatMap(flattenJsonLd).filter(hasProductType);
  const product = products[0];
  if (!product) return {};

  const title = compactText(product.name);
  const brand = brandName(product.brand) ?? findKnownBrand(title);
  const reference =
    compactText(product.sku) ??
    compactText(product.mpn) ??
    compactText(product.productID) ??
    parseReference(title);
  const model = compactText(product.model) ?? bestModelFromTitle(title, brand, reference);
  const description = compactText(product.description);
  const offer = firstOffer(product);
  const priceText = compactText(offer?.price) ?? compactText(offer?.lowPrice) ?? compactText(offer?.highPrice);
  const currency = compactText(offer?.priceCurrency) ?? parseCurrency(`${priceText ?? ""} ${description ?? ""}`);
  const availability = inferAvailability(compactText(offer?.availability));
  const imageUrls = asStringArray(product.image);
  const condition = inferCondition(`${product.itemCondition ?? ""} ${description ?? ""}`);
  const year = parseYear(`${title ?? ""} ${description ?? ""}`);
  const hype = inferHype(brand, model);
  const category = categorizeWatch(brand);

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
    publicImages: imageUrls,
    tags: tagsForDraft({ brand, model, category, hype, newArrival: true }),
  };
}
