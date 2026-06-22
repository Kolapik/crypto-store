import { lookup } from "node:dns/promises";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `/uploads/${key}` })),
}));

import { GenericStructuredDataAdapter, parseSrcset } from "./supplierSync/adapters";
import { inferCategory } from "./supplierSync/category";
import { fetchSupplierPage } from "./supplierSync/fetch";
import { imageContentAllowed } from "./supplierSync/images";
import { calculatePublicPrice } from "./supplierSync/pricing";
import { assertSupplierScopedUrl, SupplierUrlSecurityError } from "./supplierSync/url";
import type { SupplierConfig } from "./supplierSync/types";

const supplier: SupplierConfig = {
  id: 1,
  privateName: "Allowed Supplier",
  allowedHostname: "allowed.example",
  allowedPathPrefixes: ["/catalogue", "/product", "/images"],
  catalogueUrl: "https://allowed.example/catalogue",
  defaultMarkupPercent: "20.00",
  targetCurrency: "CHF",
  autoPublish: false,
  autoPublishMinimumConfidence: "0.90",
  downloadImages: true,
  priceChangeReviewThresholdPercent: "25.00",
  missingProductDisableThreshold: 3,
};

describe("supplier sync URL safety", () => {
  beforeEach(() => {
    vi.mocked(lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects localhost, raw IPs, unapproved domains, and path escapes", async () => {
    await expect(assertSupplierScopedUrl("http://localhost/product/1", supplier)).rejects.toThrow(/local|internal/i);
    await expect(assertSupplierScopedUrl("http://127.0.0.1/product/1", supplier)).rejects.toThrow(/private|raw ip/i);
    await expect(assertSupplierScopedUrl("https://evil.example/product/1", supplier)).rejects.toThrow(/outside/i);
    await expect(assertSupplierScopedUrl("https://allowed.example/admin", supplier)).rejects.toThrow(/path/i);
  });

  it("rejects public hostnames that resolve to private networks", async () => {
    vi.mocked(lookup).mockResolvedValue([{ address: "10.0.0.8", family: 4 }]);
    await expect(assertSupplierScopedUrl("https://allowed.example/product/1", supplier)).rejects.toThrow(/private network/i);
  });

  it("revalidates redirect locations before following them", async () => {
    global.fetch = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/product/1" },
      }),
    ) as typeof fetch;

    await expect(fetchSupplierPage({ url: "https://allowed.example/product/1", supplier })).rejects.toThrow(
      SupplierUrlSecurityError,
    );
  });
});

describe("supplier sync extraction", () => {
  it("selects the real product JSON-LD instead of recommendation products", async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            [
              {"@type":"Product","name":"Recommended Wallet","url":"https://allowed.example/product/wallet","offers":{"price":"300","priceCurrency":"CHF"}},
              {"@type":"Product","name":"Rolex Daytona 116500LN","url":"https://allowed.example/product/daytona","brand":{"name":"Rolex"},"sku":"116500LN","image":["https://allowed.example/images/daytona-1600.jpg"],"offers":{"price":"29500","priceCurrency":"CHF","availability":"https://schema.org/InStock"}}
            ]
          </script>
        </head>
        <body><h1>Rolex Daytona 116500LN</h1></body>
      </html>
    `;

    const result = await GenericStructuredDataAdapter.extractProduct({
      html,
      pageUrl: new URL("https://allowed.example/product/daytona"),
      supplier,
    });

    expect(result).toMatchObject({
      title: "Rolex Daytona 116500LN",
      brand: "Rolex",
      sku: "116500LN",
      supplierPrice: "29500.00",
      availability: "in_stock",
    });
    expect(result?.images[0].url).toContain("daytona-1600.jpg");
  });

  it("parses ProductGroup variants", async () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type":"ProductGroup",
          "name":"Luxury Sneaker",
          "url":"https://allowed.example/product/sneaker",
          "category":"Sneakers",
          "hasVariant":[
            {"@type":"Product","name":"Luxury Sneaker 42","sku":"SN-42","offers":{"price":"900","priceCurrency":"CHF"}},
            {"@type":"Product","name":"Luxury Sneaker 43","sku":"SN-43","offers":{"price":"900","priceCurrency":"CHF"}}
          ]
        }
      </script>
      <h1>Luxury Sneaker</h1>
    `;
    const result = await GenericStructuredDataAdapter.extractProduct({
      html,
      pageUrl: new URL("https://allowed.example/product/sneaker"),
      supplier,
    });
    expect(result?.variants).toHaveLength(2);
    expect(result?.variants[0]).toMatchObject({ sku: "SN-42", supplierPrice: "900.00" });
  });

  it("keeps the highest-resolution srcset candidate", () => {
    const candidates = parseSrcset("/a-320.jpg 320w, /a-1200.jpg 1200w, /a-2x.jpg 2x");
    expect(candidates[0].url).toBe("/a-1200.jpg");
  });
});

describe("supplier sync rules", () => {
  it("rejects SVG images before storage", () => {
    expect(imageContentAllowed("image/jpeg")).toBe(true);
    expect(imageContentAllowed("image/svg+xml")).toBe(false);
  });

  it("infers non-watch categories without publishing them to the storefront", () => {
    expect(inferCategory({ title: "Luxury Sneaker", category: "Sneakers", breadcrumbs: [], productType: undefined }).slug).toBe("chaussures");
    expect(inferCategory({ title: "Rolex Submariner", brand: "Rolex", category: "Watches", breadcrumbs: [], productType: undefined }).productType).toBe("watch");
  });

  it("holds large public price changes for review and never calculates from null supplier price", () => {
    const supplierPricing = { defaultMarkupPercent: "20.00", targetCurrency: "CHF", priceChangeReviewThresholdPercent: "25.00" };
    const missing = calculatePublicPrice({ supplierPrice: null, supplier: supplierPricing });
    expect(missing.priceReviewRequired).toBe(true);
    expect(missing.publicPrice).toBeNull();

    const changed = calculatePublicPrice({
      supplierPrice: "2000.00",
      supplier: supplierPricing,
      product: { publicPrice: "1000.00", manualOverrides: {} },
    });
    expect(changed.publicPrice).toBe("2400.00");
    expect(changed.priceReviewRequired).toBe(true);
  });
});
