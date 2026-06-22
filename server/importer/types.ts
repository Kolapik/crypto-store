import type { InsertWatch } from "../../drizzle/schema";
import type { AdminWatch } from "../db";

export type AllowedSupplierDomain =
  | "timeworld.ch"
  | "bucherer.com"
  | "watchfinder.ch"
  | "tawatch.ch"
  | "emeraude.ch";

export type ImportedImageInput = {
  filename: string;
  contentType: string;
  dataBase64: string;
};

export type RawImportData = {
  jsonLd: unknown[];
  meta: Record<string, string>;
  selectors: Record<string, string>;
  textSample: string;
  imageUrls: string[];
  manualText?: string;
};

export type ParsedWatchDraft = {
  brand?: string;
  model?: string;
  title?: string;
  reference?: string;
  year?: number;
  condition?: InsertWatch["condition"];
  boxPapers?: string;
  movement?: string;
  caseSize?: string;
  material?: string;
  dialColor?: string;
  braceletMaterial?: string;
  publicPrice?: string;
  currency?: string;
  description?: string;
  availability?: InsertWatch["availability"];
  category?: string;
  tags?: string[];
  featured?: boolean;
  hype?: boolean;
  newArrival?: boolean;
  supplierName?: string;
  supplierDomain?: string;
  supplierUrl?: string;
  sourceUrl?: string;
  supplierPrice?: string;
  publicImages?: string[];
  warnings: string[];
  raw: RawImportData;
};

export type ImportWatchInput = {
  url: string;
  manualText?: string;
  manualImages?: ImportedImageInput[];
};

export type ImportWatchResult = {
  watch: AdminWatch;
  warnings: string[];
};
