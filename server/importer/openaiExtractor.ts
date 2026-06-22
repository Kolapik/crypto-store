import { ENV } from "../_core/env";
import {
  categorizeWatch,
  compactText,
  inferHype,
  tagsForDraft,
} from "./normalizer";
import type { ParsedWatchDraft } from "./types";

type AiWatchDraft = {
  brand: string | null;
  model: string | null;
  title: string | null;
  reference: string | null;
  year: number | null;
  condition: "unworn" | "excellent" | "very_good" | "good" | "fair" | null;
  boxPapers: string | null;
  movement: string | null;
  caseSize: string | null;
  material: string | null;
  dialColor: string | null;
  braceletMaterial: string | null;
  publicPrice: string | null;
  currency: string | null;
  description: string | null;
  availability: "available" | "reserved" | "sold" | "hidden" | null;
  category: string | null;
  tags: string[];
  hype: boolean | null;
  newArrival: boolean | null;
  warnings: string[];
};

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brand: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    reference: { type: ["string", "null"] },
    year: { type: ["integer", "null"], minimum: 1900, maximum: 2099 },
    condition: {
      type: ["string", "null"],
      enum: ["unworn", "excellent", "very_good", "good", "fair", null],
    },
    boxPapers: { type: ["string", "null"] },
    movement: { type: ["string", "null"] },
    caseSize: { type: ["string", "null"] },
    material: { type: ["string", "null"] },
    dialColor: { type: ["string", "null"] },
    braceletMaterial: { type: ["string", "null"] },
    publicPrice: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    availability: {
      type: ["string", "null"],
      enum: ["available", "reserved", "sold", "hidden", null],
    },
    category: { type: ["string", "null"] },
    tags: { type: "array", items: { type: "string" } },
    hype: { type: ["boolean", "null"] },
    newArrival: { type: ["boolean", "null"] },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: [
    "brand",
    "model",
    "title",
    "reference",
    "year",
    "condition",
    "boxPapers",
    "movement",
    "caseSize",
    "material",
    "dialColor",
    "braceletMaterial",
    "publicPrice",
    "currency",
    "description",
    "availability",
    "category",
    "tags",
    "hype",
    "newArrival",
    "warnings",
  ],
} as const;

function value(value: unknown) {
  return compactText(value)?.slice(0, 2_000) ?? null;
}

function extractResponseText(payload: unknown) {
  const object = payload as Record<string, unknown>;
  if (typeof object.output_text === "string") return object.output_text;

  const output = Array.isArray(object.output) ? object.output : [];
  for (const item of output) {
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const partObject = part as Record<string, unknown>;
      if (typeof partObject.text === "string") return partObject.text;
    }
  }

  return null;
}

function aiToDraft(result: AiWatchDraft): Partial<ParsedWatchDraft> {
  const brand = value(result.brand) ?? undefined;
  const model = value(result.model) ?? undefined;
  const category = value(result.category) ?? categorizeWatch(brand);
  const hype = result.hype ?? inferHype(brand, model);

  return {
    brand,
    model,
    title: value(result.title) ?? undefined,
    reference: value(result.reference) ?? undefined,
    year: typeof result.year === "number" ? result.year : undefined,
    condition: result.condition ?? undefined,
    boxPapers: value(result.boxPapers) ?? undefined,
    movement: value(result.movement) ?? undefined,
    caseSize: value(result.caseSize) ?? undefined,
    material: value(result.material) ?? undefined,
    dialColor: value(result.dialColor) ?? undefined,
    braceletMaterial: value(result.braceletMaterial) ?? undefined,
    publicPrice: value(result.publicPrice) ?? undefined,
    currency: value(result.currency)?.toUpperCase() ?? undefined,
    description: value(result.description) ?? undefined,
    availability: result.availability ?? undefined,
    category,
    tags: result.tags?.length
      ? result.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12)
      : tagsForDraft({ brand, model, category, hype, newArrival: result.newArrival ?? true }),
    hype,
    newArrival: result.newArrival ?? true,
  };
}

export async function extractWatchWithOpenAI(input: {
  parsed: ParsedWatchDraft;
  pageUrl: URL;
  supplierDomain: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY || ENV.openaiApiKey;
  if (!apiKey) {
    return { draft: {}, warnings: ["OpenAI extraction skipped because OPENAI_API_KEY is not configured."] };
  }

  const source = {
    supplierDomain: input.supplierDomain,
    sourceUrl: input.pageUrl.toString(),
    meta: input.parsed.raw.meta,
    selectors: input.parsed.raw.selectors,
    textSample: input.parsed.raw.textSample.slice(0, 8_000),
    manualText: input.parsed.raw.manualText?.slice(0, 8_000) ?? null,
    currentParserDraft: {
      brand: input.parsed.brand ?? null,
      model: input.parsed.model ?? null,
      title: input.parsed.title ?? null,
      reference: input.parsed.reference ?? null,
      publicPrice: input.parsed.publicPrice ?? null,
      currency: input.parsed.currency ?? null,
      category: input.parsed.category ?? null,
    },
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || ENV.openaiModel || "gpt-5.5",
        instructions:
          "Extract luxury watch catalogue fields from retailer page text. Return null for unknown values. Do not invent reference numbers, prices, years, or box/papers. Keep supplier-private information out of public description. Output only the requested JSON schema.",
        input: JSON.stringify(source),
        reasoning: { effort: "low" },
        text: {
          format: {
            type: "json_schema",
            name: "watch_import_extraction",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      return { draft: {}, warnings: [`OpenAI extraction skipped: API returned HTTP ${response.status}.`] };
    }

    const payload = (await response.json()) as unknown;
    const text = extractResponseText(payload);
    if (!text) return { draft: {}, warnings: ["OpenAI extraction skipped: no structured response text."] };

    const result = JSON.parse(text) as AiWatchDraft;
    return {
      draft: aiToDraft(result),
      warnings: [
        "OpenAI extraction used; review all fields before publishing.",
        ...(result.warnings ?? []).slice(0, 8),
      ],
    };
  } catch {
    return { draft: {}, warnings: ["OpenAI extraction skipped because the API response could not be processed."] };
  }
}
