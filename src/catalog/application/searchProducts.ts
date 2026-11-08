import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { toProductList, toSearchQuery } from '#/catalog/domain/productSearch.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

export interface CatalogRepositories {
  readonly categories: Catalog.CategoryRepository
  readonly products: Catalog.ProductRepository
}

/**
 * Cas d'utilisation « rechercher des produits » : charge l'arbre par son port, résout la
 * catégorie (CategoryNotFoundError si elle est inconnue), puis confie au dépôt le filtre, le tri,
 * la pagination et le comptage disjonctif (chaque facette compte sans ses propres filtres).
 */
export const searchProducts = async (
  criteria: Catalog.Criteria,
  repositories: CatalogRepositories,
): Promise<Catalog.ProductList> => {
  const tree = CategoryTree.of(await repositories.categories.findAll())
  const current = criteria.category === null ? null : CategoryTree.find(tree, criteria.category)
  const children = CategoryTree.childrenOf(tree, current)
  const result = await repositories.products.search(toSearchQuery(criteria, children))

  return toProductList(children, result)
}
