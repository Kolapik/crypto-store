import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async (key: string) => ({ key, url: `/uploads/${key}` })),
}));

import { getPublicWatches } from "./db";
import { importWatchFromUrl } from "./importer/importWatch";
import { extractWatchWithOpenAI } from "./importer/openaiExtractor";
import { parseGenericHtml } from "./importer/parseHtml";
import { validateSupplierUrl } from "./importer/urlSecurity";

const pageHtml = `
  <!doctype html>
  <html>
    <head>
      <title>Rolex Daytona 116500LN</title>
      <meta property="og:title" content="Rolex Cosmograph Daytona 116500LN" />
      <meta property="og:image" content="https://www.bucherer.com/images/daytona.jpg" />
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Rolex Cosmograph Daytona 116500LN",
          "brand": { "@type": "Brand", "name": "Rolex" },
          "sku": "116500LN",
          "description": "Excellent full set automatic chronograph, white dial, 40 mm stainless steel bracelet.",
          "image": ["https://www.bucherer.com/images/daytona.jpg"],
          "offers": {
            "@type": "Offer",
            "price": "29500",
            "priceCurrency": "CHF",
            "availability": "https://schema.org/InStock"
          }
        }
      </script>
    </head>
    <body><h1>Rolex Cosmograph Daytona 116500LN</h1></body>
  </html>
`;

describe("retailer URL importer", () => {
  beforeAll(() => {
    process.env.NO_DATABASE = "1";
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    global.fetch = vi.fn(async (url: string | URL) => {
      const href = String(url);
      if (href.endsWith(".jpg")) {
        return new Response(Buffer.from("fake-jpeg"), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      return new Response(pageHtml, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }) as typeof fetch;
  });

  it("rejects non-allowed supplier domains", async () => {
    await expect(validateSupplierUrl("https://example.com/watch")).rejects.toThrow(/allowed supplier/i);
  });

  it("rejects localhost and internal URLs", async () => {
    await expect(validateSupplierUrl("http://localhost/watch")).rejects.toThrow(/local|internal/i);
    await expect(validateSupplierUrl("http://127.0.0.1/watch")).rejects.toThrow(/private|raw ip/i);
  });

  it("creates a private draft and copies images instead of hotlinking", async () => {
    const before = await getPublicWatches({ search: "116500LN" });
    const result = await importWatchFromUrl({
      url: "https://www.bucherer.com/ch/en/watches/rolex/daytona-116500ln.html",
      manualText: "Full set with box and papers.",
    });
    const after = await getPublicWatches({ search: "116500LN" });

    expect(result.watch).toMatchObject({
      brand: "Rolex",
      reference: "116500LN",
      publicationStatus: "draft",
      visibility: "private",
      importedFromUrl: true,
      supplierDomain: "bucherer.com",
    });
    expect(result.watch.publicImages[0]).toContain("/uploads/imports/bucherer.com/");
    expect(result.watch.publicImages[0]).not.toContain("bucherer.com/images");
    expect(after).toHaveLength(before.length);
  });

  it("prefers the largest srcset image instead of tiny thumbnails", () => {
    const parsed = parseGenericHtml({
      pageUrl: new URL("https://www.bucherer.com/ch/en/watch.html"),
      supplierDomain: "bucherer.com",
      html: `
        <html>
          <head><title>Rolex Submariner 124060</title></head>
          <body>
            <h1>Rolex Submariner 124060</h1>
            <img src="/assets/logo.png" />
            <img srcset="/images/sub-small-320.jpg 320w, /images/sub-large-1600.jpg 1600w" />
          </body>
        </html>
      `,
    });

    expect(parsed.publicImages?.[0]).toContain("sub-large-1600.jpg");
    expect(parsed.publicImages?.join(" ")).not.toContain("logo.png");
  });

  it("can enhance a parsed draft with a mocked OpenAI structured response", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const parsed = parseGenericHtml({
      pageUrl: new URL("https://www.bucherer.com/ch/en/watch.html"),
      supplierDomain: "bucherer.com",
      html: "<html><head><title>Imported watch</title></head><body>Rolex Submariner 124060 CHF 12800</body></html>",
    });

    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({
        output_text: JSON.stringify({
          brand: "Rolex",
          model: "Submariner",
          title: "Rolex Submariner 124060",
          reference: "124060",
          year: 2024,
          condition: "excellent",
          boxPapers: "Full set",
          movement: "Automatic",
          caseSize: "41 mm",
          material: "Oystersteel",
          dialColor: "Black",
          braceletMaterial: "Oystersteel",
          publicPrice: "12800.00",
          currency: "CHF",
          description: "Customer-safe catalogue description.",
          availability: "available",
          category: "Rolex",
          tags: ["Rolex", "Submariner"],
          hype: true,
          newArrival: true,
          warnings: [],
        }),
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await extractWatchWithOpenAI({
      parsed,
      pageUrl: new URL("https://www.bucherer.com/ch/en/watch.html"),
      supplierDomain: "bucherer.com",
    });

    expect(result.draft).toMatchObject({
      brand: "Rolex",
      model: "Submariner",
      reference: "124060",
      publicPrice: "12800.00",
    });
    expect(result.warnings[0]).toContain("OpenAI extraction used");
    expect((global.fetch as any).mock.calls[0][1].headers.authorization).toBe("Bearer test-openai-key");
  });
});
