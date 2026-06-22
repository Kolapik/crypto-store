import { parseGenericHtml } from "./parseHtml";
import { parseBucherer } from "./supplierParsers/bucherer";
import { parseEmeraude } from "./supplierParsers/emeraude";
import { parseTawatch } from "./supplierParsers/tawatch";
import { parseTimeworld } from "./supplierParsers/timeworld";
import { parseWatchfinder } from "./supplierParsers/watchfinder";
import type { AllowedSupplierDomain } from "./types";

type ParserInput = Parameters<typeof parseGenericHtml>[0];
type SupplierParser = (input: ParserInput) => ReturnType<typeof parseGenericHtml>;

const PARSERS: Record<AllowedSupplierDomain, SupplierParser> = {
  "timeworld.ch": parseTimeworld,
  "bucherer.com": parseBucherer,
  "watchfinder.ch": parseWatchfinder,
  "tawatch.ch": parseTawatch,
  "emeraude.ch": parseEmeraude,
};

export function parserForSupplier(domain: AllowedSupplierDomain) {
  return PARSERS[domain] ?? parseGenericHtml;
}
