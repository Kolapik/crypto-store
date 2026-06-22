import { createWatch } from "../db";
import { fetchSupplierPage } from "./fetchPage";
import { copyManualImages, copySupplierImages } from "./imageImport";
import { compactText } from "./normalizer";
import { extractWatchWithOpenAI } from "./openaiExtractor";
import { parserForSupplier } from "./parserRegistry";
import type { ImportWatchInput, ImportWatchResult, ParsedWatchDraft } from "./types";
import { ImportSecurityError, validateSupplierUrl } from "./urlSecurity";

function slugify(...parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function fallbackBrand(parsed: ParsedWatchDraft, warnings: string[]) {
  if (parsed.brand) return parsed.brand;
  warnings.push("Brand is required, so the draft was created with 'Unknown brand'.");
  return "Unknown brand";
}

function fallbackModel(parsed: ParsedWatchDraft, warnings: string[]) {
  if (parsed.model) return parsed.model;
  if (parsed.title) return parsed.title.slice(0, 240);
  warnings.push("Model is required, so the draft was created with 'Imported watch'.");
  return "Imported watch";
}

function mergeAiDraft(parsed: ParsedWatchDraft, aiDraft: Partial<ParsedWatchDraft>): ParsedWatchDraft {
  const merged = { ...parsed };
  for (const [key, value] of Object.entries(aiDraft) as [keyof ParsedWatchDraft, unknown][]) {
    if (key === "warnings" || key === "raw" || key === "publicImages") continue;
    const current = merged[key];
    const missing =
      current === undefined ||
      current === null ||
      current === "" ||
      (Array.isArray(current) && current.length === 0);
    if (missing && value !== undefined && value !== null && value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function activeParserWarnings(parsed: ParsedWatchDraft) {
  return parsed.warnings.filter((warning) => {
    if (parsed.brand && warning.startsWith("Brand was not")) return false;
    if (parsed.model && warning.startsWith("Model was not")) return false;
    if (parsed.reference && warning.startsWith("Reference was not")) return false;
    if (parsed.publicPrice && warning.startsWith("Public price was not")) return false;
    return true;
  });
}

export async function importWatchFromUrl(input: ImportWatchInput): Promise<ImportWatchResult> {
  const original = await validateSupplierUrl(input.url);
  const fetched = await fetchSupplierPage(original.url);
  const finalUrl = await validateSupplierUrl(fetched.finalUrl.toString());

  if (finalUrl.domain !== original.domain) {
    throw new ImportSecurityError("Supplier URL redirected to a different approved supplier domain.");
  }

  const parser = parserForSupplier(original.domain);
  const initialParsed = parser({
    html: fetched.html,
    pageUrl: finalUrl.url,
    supplierDomain: original.domain,
    manualText: input.manualText,
  });
  const aiExtraction = await extractWatchWithOpenAI({
    parsed: initialParsed,
    pageUrl: finalUrl.url,
    supplierDomain: original.domain,
  });
  const parsed = mergeAiDraft(initialParsed, aiExtraction.draft);
  const warnings = activeParserWarnings(parsed);
  warnings.push(...aiExtraction.warnings);

  const supplierImages = await copySupplierImages({
    imageUrls: parsed.publicImages ?? [],
    pageUrl: finalUrl.url,
    supplierDomain: original.domain,
  });
  warnings.push(...supplierImages.warnings);

  const manualImages = await copyManualImages(input.manualImages, original.domain);
  warnings.push(...manualImages.warnings);

  const publicImages = [...supplierImages.urls, ...manualImages.urls];
  if (!publicImages.length) {
    warnings.push("Draft created without images. Add images manually before publishing.");
  }

  const brand = fallbackBrand(parsed, warnings);
  const model = fallbackModel(parsed, warnings);
  const title = compactText(parsed.title) ?? `${brand} ${model}`.trim();
  const now = new Date();
  const importStatus = warnings.length ? "partial_draft_created" : "draft_created";

  const watch = await createWatch({
    brand,
    model,
    title,
    reference: parsed.reference,
    year: parsed.year,
    condition: parsed.condition ?? "excellent",
    boxPapers: parsed.boxPapers,
    movement: parsed.movement,
    caseSize: parsed.caseSize,
    material: parsed.material,
    dialColor: parsed.dialColor,
    braceletMaterial: parsed.braceletMaterial,
    publicPrice: parsed.publicPrice,
    currency: parsed.currency ?? "CHF",
    availability: parsed.availability ?? "available",
    visibility: "private",
    publicationStatus: "draft",
    category: parsed.category,
    tags: parsed.tags ?? [],
    featured: false,
    hype: parsed.hype ?? false,
    newArrival: parsed.newArrival ?? true,
    description: parsed.description,
    publicImages,
    importedFromUrl: true,
    supplierName: parsed.supplierName ?? original.domain,
    supplierDomain: original.domain,
    supplierUrl: parsed.supplierUrl ?? original.url.origin,
    sourceUrl: finalUrl.url.toString(),
    supplierPrice: parsed.supplierPrice,
    importRawData: parsed.raw,
    importStatus,
    importErrors: warnings,
    internalNotes: `Imported as an unpublished draft from ${finalUrl.url.toString()}. Review all fields before publishing.`,
    importedAt: now,
    lastCheckedAt: now,
    slug: `${slugify(brand, model, parsed.reference) || "imported-watch"}-${Date.now()}`,
  });

  return { watch, warnings };
}

export { ImportSecurityError } from "./urlSecurity";
