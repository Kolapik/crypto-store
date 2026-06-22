import {
  bestModelFromTitle,
  categorizeWatch,
  compactText,
  findKnownBrand,
  inferAvailability,
  inferCondition,
  inferHype,
  inferSpecs,
  parseCurrency,
  parsePrice,
  parseReference,
  parseYear,
  tagsForDraft,
} from "./normalizer";
import type { ParsedWatchDraft } from "./types";

export function parseHeuristicProduct(input: {
  title?: string;
  selectors: Record<string, string>;
  text: string;
}): Partial<ParsedWatchDraft> {
  const title = compactText(input.title ?? input.selectors.h1);
  const text = `${title ?? ""} ${Object.values(input.selectors).join(" ")} ${input.text}`;
  const brand = findKnownBrand(text);
  const reference = parseReference(text);
  const model = bestModelFromTitle(title, brand, reference);
  const specs = inferSpecs(text);
  const hype = inferHype(brand, model);
  const category = categorizeWatch(brand);
  const priceCandidate = text.match(/(?:CHF|EUR|USD|GBP|€|\$|£)\s?[0-9][0-9'., ]+/i)?.[0];

  return {
    title,
    brand,
    model,
    reference,
    year: parseYear(text),
    condition: inferCondition(text),
    boxPapers: /full set|box and papers|box\/papers/i.test(text) ? "Full set" : undefined,
    movement: specs.movement,
    caseSize: specs.caseSize,
    material: specs.material,
    dialColor: specs.dialColor,
    braceletMaterial: specs.braceletMaterial,
    publicPrice: parsePrice(priceCandidate),
    currency: parseCurrency(priceCandidate ?? text),
    availability: inferAvailability(text),
    category,
    hype,
    newArrival: true,
    featured: hype,
    tags: tagsForDraft({ brand, model, category, hype, newArrival: true }),
  };
}
