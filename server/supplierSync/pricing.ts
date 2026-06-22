import type { ProductCategory, SupplierProduct } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import type { SupplierConfig } from "./types";

type PriceInput = {
  supplierPrice?: string | number | null;
  supplierCurrency?: string | null;
  supplier: Pick<SupplierConfig, "defaultMarkupPercent" | "targetCurrency" | "priceChangeReviewThresholdPercent">;
  category?: Pick<ProductCategory, "markupPercent" | "fixedFee" | "roundingRule"> | null;
  product?: Pick<SupplierProduct, "manualOverrides" | "publicPrice"> | null;
};

export type PriceResult = {
  publicPrice: string | null;
  publicCurrency: string | null;
  markupPercentApplied: string | null;
  fixedFeeApplied: string | null;
  priceReviewRequired: boolean;
  reviewReason?: string;
};

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function overrideNumber(source: unknown, key: string) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  return numeric((source as Record<string, unknown>)[key]);
}

function roundPrice(value: number, rule?: string) {
  if (rule === "nearest_10") return Math.round(value / 10) * 10;
  if (rule === "nearest_100") return Math.round(value / 100) * 100;
  if (rule === "ceil_100") return Math.ceil(value / 100) * 100;
  if (rule === "none") return value;
  return Math.round(value / 50) * 50;
}

export function calculatePublicPrice(input: PriceInput): PriceResult {
  const supplierPrice = numeric(input.supplierPrice);
  if (supplierPrice === null) {
    return {
      publicPrice: null,
      publicCurrency: input.supplier.targetCurrency,
      markupPercentApplied: null,
      fixedFeeApplied: null,
      priceReviewRequired: true,
      reviewReason: "Supplier price missing; public price was not calculated.",
    };
  }

  const manualMarkup = overrideNumber(input.product?.manualOverrides, "markupPercent");
  const manualFixedFee = overrideNumber(input.product?.manualOverrides, "fixedFee");
  const categoryMarkup = numeric(input.category?.markupPercent);
  const categoryFixedFee = numeric(input.category?.fixedFee);
  const markupPercent = manualMarkup ?? categoryMarkup ?? numeric(input.supplier.defaultMarkupPercent) ?? 0;
  const fixedFee = manualFixedFee ?? categoryFixedFee ?? 0;
  const rawPublicPrice = supplierPrice * (1 + markupPercent / 100) + fixedFee;
  const roundedPublicPrice = roundPrice(rawPublicPrice, input.category?.roundingRule);
  const previous = numeric(input.product?.publicPrice);
  const threshold =
    numeric(input.supplier.priceChangeReviewThresholdPercent) ??
    ENV.priceChangeReviewThresholdPercent;
  const changePercent = previous && previous > 0 ? Math.abs((roundedPublicPrice - previous) / previous) * 100 : 0;
  const reviewRequired = Boolean(previous && threshold > 0 && changePercent > threshold);

  return {
    publicPrice: roundedPublicPrice.toFixed(2),
    publicCurrency: input.supplier.targetCurrency || input.supplierCurrency || "CHF",
    markupPercentApplied: markupPercent.toFixed(2),
    fixedFeeApplied: fixedFee.toFixed(2),
    priceReviewRequired: reviewRequired,
    reviewReason: reviewRequired
      ? `Supplier price changed public price by ${changePercent.toFixed(1)}%, above ${threshold}%.`
      : undefined,
  };
}
