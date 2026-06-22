import { and, eq, ilike } from "drizzle-orm";
import {
  categoryMappings,
  productCategories,
  type ProductCategory,
} from "../../drizzle/schema";
import type { getDb } from "../db";
import type { RawSupplierProduct } from "./types";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const CATEGORY_RULES: Array<{ slug: string; words: RegExp[]; productType: string }> = [
  { slug: "montres", productType: "watch", words: [/watch/i, /watches/i, /montre/i, /montres/i, /rolex/i, /patek/i, /omega/i, /audemars/i] },
  { slug: "sacs", productType: "bag", words: [/bag/i, /sac/i, /handbag/i, /malle/i] },
  { slug: "chaussures", productType: "shoes", words: [/shoe/i, /shoes/i, /sneaker/i, /boot/i, /chaussure/i] },
  { slug: "vetements", productType: "clothing", words: [/shirt/i, /jacket/i, /coat/i, /robe/i, /veste/i, /vetement/i, /clothing/i] },
  { slug: "bijoux", productType: "jewelry", words: [/jewel/i, /ring/i, /bracelet/i, /necklace/i, /bijou/i, /bague/i] },
  { slug: "accessoires", productType: "accessory", words: [/accessor/i, /sunglass/i, /belt/i, /wallet/i, /lunette/i] },
];

function haystack(product: Pick<RawSupplierProduct, "title" | "brand" | "category" | "breadcrumbs" | "productType">) {
  return [
    product.productType,
    product.title,
    product.brand,
    product.category,
    ...(product.breadcrumbs ?? []),
  ].filter(Boolean).join(" ");
}

export function inferCategory(product: Pick<RawSupplierProduct, "title" | "brand" | "category" | "breadcrumbs" | "productType">) {
  const text = haystack(product);
  const explicitType = product.productType?.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (explicitType === rule.productType || rule.words.some((word) => word.test(text))) {
      return {
        slug: rule.slug,
        productType: rule.productType,
        confidence: explicitType === rule.productType ? 0.9 : 0.72,
      };
    }
  }
  return { slug: "non-classe", productType: explicitType || "unknown", confidence: 0.35 };
}

export async function resolveCategoryForProduct(
  db: Db,
  supplierId: number,
  product: RawSupplierProduct,
): Promise<{ category: ProductCategory | null; productType: string; confidence: string }> {
  const sourceValues = [product.category, ...product.breadcrumbs].filter(
    (value): value is string => Boolean(value?.trim()),
  );

  for (const sourceValue of sourceValues) {
    const mapping = await db
      .select({ category: productCategories, mapping: categoryMappings })
      .from(categoryMappings)
      .innerJoin(productCategories, eq(categoryMappings.destinationCategoryId, productCategories.id))
      .where(
        and(
          eq(categoryMappings.supplierId, supplierId),
          ilike(categoryMappings.sourceValue, sourceValue),
        ),
      )
      .limit(1);
    if (mapping[0]) {
      return {
        category: mapping[0].category,
        productType: inferCategory(product).productType,
        confidence: String(mapping[0].mapping.confidence),
      };
    }
  }

  const inferred = inferCategory(product);
  const categories = await db
    .select()
    .from(productCategories)
    .where(eq(productCategories.slug, inferred.slug))
    .limit(1);

  return {
    category: categories[0] ?? null,
    productType: product.productType ?? inferred.productType,
    confidence: inferred.confidence.toFixed(2),
  };
}
