import { z } from "zod";
import type { Supplier } from "../../drizzle/schema";

export const SupplierAvailabilitySchema = z.enum([
  "in_stock",
  "out_of_stock",
  "preorder",
  "backorder",
  "unknown",
]);

export const RawSupplierImageSchema = z.object({
  url: z.string().min(1),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  score: z.number().optional(),
});

export const RawSupplierVariantSchema = z.object({
  sourceVariantId: z.string().optional(),
  sku: z.string().optional(),
  title: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  material: z.string().optional(),
  options: z.record(z.string(), z.string()).default({}),
  supplierPrice: z.string().optional(),
  currency: z.string().length(3).optional(),
  availability: SupplierAvailabilitySchema.default("unknown"),
  imageUrl: z.string().optional(),
});

export const RawSupplierProductSchema = z.object({
  canonicalUrl: z.string().url(),
  sourceProductId: z.string().optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  breadcrumbs: z.array(z.string()).default([]),
  productType: z.string().optional(),
  gender: z.enum(["male", "female", "unisex", "unknown"]).default("unknown"),
  condition: z.string().default("unknown"),
  supplierPrice: z.string().optional(),
  currency: z.string().length(3).optional(),
  availability: SupplierAvailabilitySchema.default("unknown"),
  images: z.array(RawSupplierImageSchema).default([]),
  variants: z.array(RawSupplierVariantSchema).default([]),
  confidence: z.number().min(0).max(1).default(0),
  fieldProvenance: z.record(z.string(), z.unknown()).default({}),
  raw: z.record(z.string(), z.unknown()).default({}),
});

export type SupplierAvailability = z.infer<typeof SupplierAvailabilitySchema>;
export type RawSupplierProduct = z.infer<typeof RawSupplierProductSchema>;
export type RawSupplierVariant = z.infer<typeof RawSupplierVariantSchema>;
export type RawSupplierImage = z.infer<typeof RawSupplierImageSchema>;

export type SupplierConfig = Pick<
  Supplier,
  | "id"
  | "privateName"
  | "allowedHostname"
  | "allowedPathPrefixes"
  | "catalogueUrl"
  | "defaultMarkupPercent"
  | "targetCurrency"
  | "autoPublish"
  | "autoPublishMinimumConfidence"
  | "downloadImages"
  | "priceChangeReviewThresholdPercent"
  | "missingProductDisableThreshold"
>;

export type FetchResult = {
  finalUrl: URL;
  statusCode: number;
  contentType: string;
  body: string;
  contentHash: string;
  retryAfterMs?: number;
};

export interface SupplierAdapter {
  name: string;
  canHandle(input: { html: string; pageUrl: URL; supplier: SupplierConfig }): boolean | Promise<boolean>;
  extractProduct(input: { html: string; pageUrl: URL; supplier: SupplierConfig }): Promise<RawSupplierProduct | null>;
}
