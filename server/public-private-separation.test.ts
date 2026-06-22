import { beforeAll, describe, expect, it } from "vitest";
import type { Watch } from "../drizzle/schema";
import { getPublicWatches, privateWatchFieldNames, toPublicWatch } from "./db";

const privateFields = privateWatchFieldNames();

function expectNoPrivateFields(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of privateFields) {
    expect(Object.prototype.hasOwnProperty.call(value as Record<string, unknown>, field)).toBe(false);
    expect(serialized).not.toContain(field);
  }
  expect(serialized).not.toContain("Private Geneva source");
  expect(serialized).not.toContain("27400.00");
  expect(serialized).not.toContain("internal-only");
}

describe("public/private watch data separation", () => {
  beforeAll(() => {
    process.env.NO_DATABASE = "1";
  });

  it("strips supplier and cost fields from a public watch DTO", () => {
    const watch: Watch = {
      id: 99,
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
      availability: "available",
      visibility: "public",
      publicationStatus: "published",
      category: "Rolex",
      tags: ["Rolex", "Submariner"],
      featured: false,
      hype: true,
      newArrival: true,
      description: "Customer-safe description",
      publicImages: ["/images/hero/ocean-dark.jpg"],
      importedFromUrl: true,
      supplierName: "Private Geneva source",
      supplierDomain: "supplier.example",
      supplierUrl: "https://supplier.example/private",
      sourceUrl: "https://source.example/private",
      supplierPrice: "27400.00",
      acquisitionCost: "28000.00",
      importRawData: { source: "private" },
      importStatus: "draft_created",
      importErrors: ["private importer warning"],
      internalNotes: "internal-only",
      importedAt: new Date(),
      lastCheckedAt: new Date(),
      slug: "rolex-submariner-124060",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const publicWatch = toPublicWatch(watch);

    expect(publicWatch).toMatchObject({
      brand: "Rolex",
      model: "Submariner",
      price: "12800.00",
      status: "available",
      imageUrl: "/images/hero/ocean-dark.jpg",
    });
    expectNoPrivateFields(publicWatch);
  });

  it("does not leak private supplier data from public watch list fallback", async () => {
    const watches = await getPublicWatches({});

    expect(watches.length).toBeGreaterThan(0);
    for (const watch of watches) {
      expectNoPrivateFields(watch);
    }
  });
});
