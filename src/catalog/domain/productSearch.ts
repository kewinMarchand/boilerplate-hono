import { EXPOSURES, SIZES } from './catalog.ts'
import { attributeIn, categoryIn } from './catalogTranslations.ts'
import { isFacet } from './productAttribute.ts'

import type { Catalog } from './catalog.ts'

const facetValues = <TValue extends string>(
  values: readonly TValue[],
  counts: Partial<Record<TValue, number>>,
): Catalog.FacetValue[] => values.map((value) => ({ value, count: counts[value] ?? 0 }))

/** Facettes d'attributs : les attributs filtrables que le dépôt a comptés, toutes leurs valeurs. */
const attributeFacets = (
  attributes: readonly Catalog.ProductAttribute[],
  counts: Catalog.SearchResult['attributeCounts'],
): Catalog.AttributeFacet[] =>
  attributes.filter(isFacet).flatMap(({ code, label, choices }) => {
    const valueCounts = counts.get(code)

    return valueCounts === undefined
      ? []
      : [
          {
            code,
            label,
            values: choices.map(({ value, label: valueLabel }) => ({
              value,
              label: valueLabel,
              count: valueCounts[value] ?? 0,
            })),
          },
        ]
  })

/** Facettes de catégorie et d'attribut dans la langue `locale` ; les compteurs restent par slug de la langue par défaut. */
export const toProductList = (
  children: readonly Catalog.Category[],
  attributes: readonly Catalog.ProductAttribute[],
  result: Catalog.SearchResult,
  locale: string | null = null,
): Catalog.ProductList => ({
  items: result.items,
  totalItems: result.totalItems,
  facets: {
    exposure: facetValues(EXPOSURES, result.exposureCounts),
    size: facetValues(SIZES, result.sizeCounts),
    category: children.map((child) => {
      const { slug, name } = categoryIn(child, locale)
      return { slug, name, count: result.categoryCounts[child.slug] ?? 0 }
    }),
    attributes: attributeFacets(
      attributes.map((attribute) => attributeIn(attribute, locale)),
      result.attributeCounts,
    ),
  },
})

export const emptyProductList = (): Catalog.ProductList => ({
  items: [],
  totalItems: 0,
  facets: {
    exposure: facetValues(EXPOSURES, {}),
    size: facetValues(SIZES, {}),
    category: [],
    attributes: [],
  },
})

/**
 * Garde les filtres des attributs filtrables et leurs valeurs connues ; un attribut sans valeur
 * connue ne filtre pas.
 */
const attributeFilters = (
  facets: readonly Catalog.ProductAttribute[],
  requested: Catalog.Criteria['attributes'],
): Map<string, string[]> =>
  new Map(
    facets.flatMap(({ code, choices }) => {
      const values = (requested.get(code) ?? []).filter((value) =>
        choices.some((choice) => choice.value === value),
      )
      return values.length === 0 ? [] : [[code, values] as const]
    }),
  )

export const toSearchQuery = (
  criteria: Catalog.Criteria,
  children: readonly Catalog.Category[],
  attributes: readonly Catalog.ProductAttribute[],
  locale: string,
): Catalog.SearchQuery => {
  const facets = attributes.filter(isFacet)

  return {
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
    attributeFilters: attributeFilters(facets, criteria.attributes),
    attributeFacets: facets.map(({ code }) => code),
    locale,
  }
}
