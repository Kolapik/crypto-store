import type { ParsedWatchDraft } from "./types";

const WATCH_BRANDS = [
  "Audemars Piguet",
  "Patek Philippe",
  "Richard Mille",
  "Vacheron Constantin",
  "Rolex",
  "Cartier",
  "Omega",
  "Tudor",
  "IWC",
  "Jaeger-LeCoultre",
  "Breitling",
  "Hublot",
  "Panerai",
  "Tag Heuer",
];

const HYPE_BRANDS = new Set(["Rolex", "Patek Philippe", "Audemars Piguet", "Richard Mille"]);

export function compactText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asStringArray);
  const text = compactText(value);
  return text ? [text] : [];
}

export function findKnownBrand(text?: string) {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return WATCH_BRANDS.find((brand) => lower.includes(brand.toLowerCase()));
}

export function categorizeWatch(brand?: string) {
  if (!brand) return "Other watches";
  return WATCH_BRANDS.includes(brand) ? brand : "Other watches";
}

export function tagsForDraft(draft: Pick<ParsedWatchDraft, "brand" | "model" | "category" | "hype" | "newArrival">) {
  return [
    draft.brand,
    draft.model,
    draft.category,
    draft.hype ? "Hype pieces" : undefined,
    draft.newArrival ? "New arrivals" : undefined,
  ].filter((item): item is string => Boolean(item && item.trim()));
}

export function inferHype(brand?: string, model?: string) {
  const modelLower = (model ?? "").toLowerCase();
  return Boolean(
    (brand && HYPE_BRANDS.has(brand)) ||
      modelLower.includes("daytona") ||
      modelLower.includes("nautilus") ||
      modelLower.includes("aquanaut") ||
      modelLower.includes("royal oak"),
  );
}

export function parseReference(text?: string) {
  if (!text) return undefined;
  const refMatch =
    text.match(/\b(?:ref(?:erence)?\.?\s*)?([A-Z0-9]{2,}(?:[-./][A-Z0-9]{2,}){1,4})\b/i) ??
    text.match(/\b([0-9]{4,6}[A-Z]{0,3}(?:-[A-Z0-9]{2,})?)\b/i);
  return compactText(refMatch?.[1]?.toUpperCase());
}

export function parseYear(text?: string) {
  if (!text) return undefined;
  const match = text.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  if (!match) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

export function parsePrice(value?: string) {
  if (!value) return undefined;
  const normalized = value
    .replace(/[^\d.,]/g, "")
    .replace(/'/g, "")
    .trim();
  if (!normalized) return undefined;
  const decimalComma = normalized.includes(",") && !normalized.includes(".");
  const numeric = decimalComma
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.replace(/,/g, "");
  const amount = Number(numeric);
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : undefined;
}

export function parseCurrency(text?: string) {
  if (!text) return undefined;
  const upper = text.toUpperCase();
  if (upper.includes("CHF")) return "CHF";
  if (upper.includes("EUR") || upper.includes("€")) return "EUR";
  if (upper.includes("USD") || upper.includes("$")) return "USD";
  if (upper.includes("GBP") || upper.includes("£")) return "GBP";
  return undefined;
}

export function inferCondition(text?: string): ParsedWatchDraft["condition"] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes("unworn") || lower.includes("new/unworn")) return "unworn";
  if (lower.includes("very good")) return "very_good";
  if (lower.includes("excellent")) return "excellent";
  if (lower.includes("fair")) return "fair";
  if (lower.includes("good")) return "good";
  return undefined;
}

export function inferAvailability(text?: string): ParsedWatchDraft["availability"] {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes("sold")) return "sold";
  if (lower.includes("reserved")) return "reserved";
  if (lower.includes("available on request") || lower.includes("on request")) return "reserved";
  if (lower.includes("available") || lower.includes("in stock")) return "available";
  return undefined;
}

export function inferSpecs(text?: string) {
  const lower = (text ?? "").toLowerCase();
  const caseSize = compactText(text?.match(/\b([3-5]\d(?:\.\d)?)\s?mm\b/i)?.[0]);
  const movement = lower.includes("manual")
    ? "Manual"
    : lower.includes("automatic")
      ? "Automatic"
      : lower.includes("quartz")
        ? "Quartz"
        : undefined;
  const material = [
    "stainless steel",
    "oystersteel",
    "yellow gold",
    "rose gold",
    "white gold",
    "platinum",
    "titanium",
    "ceramic",
    "carbon",
  ].find((item) => lower.includes(item));
  const dialColor = [
    "black",
    "white",
    "blue",
    "green",
    "silver",
    "grey",
    "gray",
    "champagne",
    "brown",
    "red",
  ].find((item) => lower.includes(`${item} dial`));
  const braceletMaterial = ["rubber", "leather", "stainless steel", "oystersteel", "gold", "titanium"].find(
    (item) => lower.includes(`${item} bracelet`) || lower.includes(`${item} strap`),
  );

  return {
    caseSize,
    movement,
    material: material ? compactText(material.replace(/\b\w/g, (char) => char.toUpperCase())) : undefined,
    dialColor: dialColor ? compactText(dialColor.replace(/\b\w/g, (char) => char.toUpperCase())) : undefined,
    braceletMaterial: braceletMaterial
      ? compactText(braceletMaterial.replace(/\b\w/g, (char) => char.toUpperCase()))
      : undefined,
  };
}

export function bestModelFromTitle(title?: string, brand?: string, reference?: string) {
  let model = compactText(title);
  if (!model) return undefined;
  if (brand) model = compactText(model.replace(new RegExp(brand, "i"), ""));
  if (reference) model = compactText(model?.replace(new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), ""));
  return model;
}
