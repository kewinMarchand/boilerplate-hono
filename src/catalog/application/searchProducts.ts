import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { toProductList, toSearchQuery } from '#/catalog/domain/productSearch.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

export interface CatalogRepositories {
  readonly categories: Catalog.CategoryRepository
  readonly products: Catalog.ProductRepository
  readonly attributes: Catalog.ProductAttributeRepository
}

/**
 * Cas d'utilisation « rechercher des produits » : charge l'arbre et les attributs par leurs ports, résout la
 * catégorie par son slug dans la langue `locale` (CategoryNotFoundError si elle est inconnue), puis
 * confie au dépôt le filtre, le tri, la pagination et le comptage disjonctif (chaque facette compte
 * sans ses propres filtres). Facettes dans la langue ; les produits restent dans la langue par défaut.
 */
export const searchProducts = async (
  criteria: Catalog.Criteria,
  repositories: CatalogRepositories,
  locale: string,
): Promise<Catalog.ProductList> => {
  const tree = CategoryTree.of(await repositories.categories.findAll())
  const current =
    criteria.category === null ? null : CategoryTree.find(tree, criteria.category, locale)
  const children = CategoryTree.childrenOf(tree, current)
  const attributes = await repositories.attributes.findAll()
  const result = await repositories.products.search(
    toSearchQuery({ ...criteria, category: current?.slug ?? null }, children, attributes, locale),
  )

  return toProductList(children, attributes, result, locale)
}
