import { EXPOSURES, SIZES } from './catalog.ts'

import type { Catalog } from './catalog.ts'

const facetValues = <TValue extends string>(
  values: readonly TValue[],
  counts: Partial<Record<TValue, number>>,
): Catalog.FacetValue[] => values.map((value) => ({ value, count: counts[value] ?? 0 }))

export const toProductList = (
  children: readonly Catalog.Category[],
  result: Catalog.SearchResult,
): Catalog.ProductList => ({
  items: result.items,
  totalItems: result.totalItems,
  facets: {
    exposure: facetValues(EXPOSURES, result.exposureCounts),
    size: facetValues(SIZES, result.sizeCounts),
    category: children.map((child) => ({
      slug: child.slug,
      name: child.name,
      count: result.categoryCounts[child.slug] ?? 0,
    })),
  },
})

export const emptyProductList = (): Catalog.ProductList => ({
  items: [],
  totalItems: 0,
  facets: { exposure: facetValues(EXPOSURES, {}), size: facetValues(SIZES, {}), category: [] },
})

export const toSearchQuery = (
  criteria: Catalog.Criteria,
  children: readonly Catalog.Category[],
): Catalog.SearchQuery => ({
  branch: criteria.category,
  children: children.map((child) => child.slug),
  exposures: criteria.exposures,
  sizes: criteria.sizes,
  priceMin: criteria.priceMin,
  priceMax: criteria.priceMax,
  inStockOnly: criteria.inStockOnly,
  sort: criteria.sort,
  skip: (criteria.page - 1) * criteria.itemsPerPage,
  limit: criteria.itemsPerPage,
})
