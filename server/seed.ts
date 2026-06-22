import { getDb } from "./db";
import { productCategories, watches } from "../drizzle/schema";

const demoWatches = [
  {
    brand: "Rolex",
    model: "Cosmograph Daytona",
    reference: "116500LN",
    year: 2023,
    condition: "excellent" as const,
    boxPapers: "Full set",
    movement: "Automatic chronograph",
    caseSize: "40 mm",
    material: "Oystersteel / Cerachrom",
    publicPrice: "29500.00",
    currency: "CHF",
    availability: "available" as const,
    visibility: "public" as const,
    featured: true,
    description:
      "White dial Daytona with full set presentation. Availability and final price are confirmed manually before payment instructions are issued.",
    publicImages: ["/images/hero/ocean-dark.jpg"],
    supplierName: "Private Geneva source",
    supplierUrl: "https://supplier-private.example/daytona",
    sourceUrl: "https://source-private.example/listing/daytona",
    supplierPrice: "27400.00",
    acquisitionCost: "28000.00",
    internalNotes: "Seed private data. Must never appear in public responses.",
    slug: "rolex-cosmograph-daytona-116500ln",
  },
  {
    brand: "Patek Philippe",
    model: "Aquanaut",
    reference: "5167A-001",
    year: 2021,
    condition: "very_good" as const,
    boxPapers: "Box and papers",
    movement: "Automatic",
    caseSize: "40.8 mm",
    material: "Stainless steel / rubber",
    publicPrice: "52500.00",
    currency: "CHF",
    availability: "reserved" as const,
    visibility: "public" as const,
    featured: true,
    description:
      "Request-based reserved listing. A new availability check is required before any sale can proceed.",
    publicImages: ["/images/hero/forest-dark.jpg"],
    supplierName: "Private Zurich source",
    supplierUrl: "https://supplier-private.example/aquanaut",
    sourceUrl: "https://source-private.example/listing/aquanaut",
    supplierPrice: "49600.00",
    acquisitionCost: "50200.00",
    internalNotes: "Seed margin and source notes remain admin-only.",
    slug: "patek-philippe-aquanaut-5167a-001",
  },
  {
    brand: "Audemars Piguet",
    model: "Royal Oak Selfwinding",
    reference: "15500ST.OO.1220ST.01",
    year: 2020,
    condition: "excellent" as const,
    boxPapers: "Full set",
    movement: "Automatic",
    caseSize: "41 mm",
    material: "Stainless steel",
    publicPrice: "39800.00",
    currency: "CHF",
    availability: "available" as const,
    visibility: "public" as const,
    featured: true,
    description:
      "Blue dial Royal Oak listed for manual request. KYC and payment review may be required before completion.",
    publicImages: ["/images/hero/forest-dark2.jpg"],
    supplierName: "EU private collection",
    supplierUrl: "https://supplier-private.example/royal-oak",
    sourceUrl: "https://source-private.example/listing/royal-oak",
    supplierPrice: "37100.00",
    acquisitionCost: "37950.00",
    internalNotes: "Seed compliance review note. Internal only.",
    slug: "audemars-piguet-royal-oak-selfwinding-15500st-oo-1220st-01",
  },
];

const db = await getDb();

if (!db) {
  console.log("No PostgreSQL connection available. Local demo fallback data is built into the development server.");
  process.exit(0);
}

for (const watch of demoWatches) {
  await db.insert(watches).values(watch).onConflictDoNothing({ target: watches.slug });
}

const categories = [
  { name: "Montres", slug: "montres" },
  { name: "Sacs", slug: "sacs" },
  { name: "Chaussures", slug: "chaussures" },
  { name: "Vetements", slug: "vetements" },
  { name: "Bijoux", slug: "bijoux" },
  { name: "Accessoires", slug: "accessoires" },
  { name: "Non classe", slug: "non-classe" },
];

for (const category of categories) {
  await db.insert(productCategories).values(category).onConflictDoNothing({ target: productCategories.slug });
}

console.log(`Seeded ${demoWatches.length} Helvetic Reserve demo watches and ${categories.length} categories.`);
