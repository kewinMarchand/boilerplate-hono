import { CatalogRuleViolation, checkImage, checkPlacement } from '#/catalog/domain/catalogRules.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

/**
 * Écritures de l'admin sur le catalogue (ADR 0001) : chaque cas d'usage vérifie les règles qui
 * consultent les autres objets (unicité, existence, suppression), puis enregistre par les ports.
 * Mêmes vérifications, dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface CatalogAdminDependencies {
  readonly categories: Catalog.CategoryRepository
  readonly categoryWriter: Catalog.CategoryWriter
  readonly productWriter: Catalog.ProductWriter
}

const loadTree = async ({ categories }: CatalogAdminDependencies): Promise<CategoryTree> =>
  CategoryTree.of(await categories.findAll())

const findIn = (tree: CategoryTree, slug: string): Catalog.Category | undefined =>
  tree.categories.find((category) => category.slug === slug)

const requireParent = (tree: CategoryTree, parent: string | null): void => {
  if (parent !== null && findIn(tree, parent) === undefined) {
    throw new CatalogRuleViolation("La catégorie parente n'existe plus.")
  }
}

const requireFreeCategorySlug = (tree: CategoryTree, slug: string, except?: string): void => {
  if (slug !== except && findIn(tree, slug) !== undefined) {
    throw new CatalogRuleViolation(`Le slug « ${slug} » est déjà pris par une autre catégorie.`)
  }
}

export const createCategory = async (
  dependencies: CatalogAdminDependencies,
  category: Catalog.Category,
): Promise<void> => {
  const tree = await loadTree(dependencies)
  requireFreeCategorySlug(tree, category.slug)
  requireParent(tree, category.parent)
  checkPlacement(tree, null, category.parent)
  await dependencies.categoryWriter.create(category)
}

/**
 * Modifie la catégorie `slug`. Un changement de slug ou de parent déplace tout son sous-arbre :
 * chaque produit de la branche reçoit sa catégorie et son chemin dans le nouvel arbre.
 */
export const updateCategory = async (
  dependencies: CatalogAdminDependencies,
  slug: string,
  category: Catalog.Category,
): Promise<void> => {
  const tree = await loadTree(dependencies)
  if (findIn(tree, slug) === undefined) {
    throw new CatalogRuleViolation("Cette catégorie n'existe plus.")
  }
  requireFreeCategorySlug(tree, category.slug, slug)
  requireParent(tree, category.parent)
  checkPlacement(tree, slug, category.parent)

  const branch = CategoryTree.branch(tree, slug)
  await dependencies.categoryWriter.update(slug, category)
  const updated = CategoryTree.of(await dependencies.categories.findAll())
  for (const previous of branch) {
    const current = previous === slug ? category.slug : previous
    await dependencies.productWriter.moveCategory(
      previous,
      current,
      CategoryTree.pathTo(updated, current),
    )
  }
}

export const deleteCategory = async (
  dependencies: CatalogAdminDependencies,
  slug: string,
): Promise<void> => {
  const tree = await loadTree(dependencies)
  const category = findIn(tree, slug)
  if (category === undefined) {
    throw new CatalogRuleViolation("Cette catégorie n'existe plus.")
  }
  if (CategoryTree.levelsBelow(tree, slug) > 0) {
    throw new CatalogRuleViolation(
      `« ${category.name} » contient des sous-catégories : les déplacer ou les supprimer d'abord.`,
    )
  }
  const count = await dependencies.productWriter.countInCategory(slug)
  if (count > 0) {
    throw new CatalogRuleViolation(
      `« ${category.name} » contient ${count} produit(s) : les déplacer ou les supprimer d'abord.`,
    )
  }
  await dependencies.categoryWriter.remove(slug)
}

const productPlacement = async (
  dependencies: CatalogAdminDependencies,
  input: Catalog.ProductInput,
  id?: number,
): Promise<string[]> => {
  const sameSlug = await dependencies.productWriter.findBySlug(input.slug)
  if (sameSlug !== null && sameSlug.id !== id) {
    throw new CatalogRuleViolation(`Le slug « ${input.slug} » est déjà pris par un autre produit.`)
  }
  const tree = await loadTree(dependencies)
  if (findIn(tree, input.categorySlug) === undefined) {
    throw new CatalogRuleViolation("La catégorie du produit n'existe pas.")
  }
  checkImage(input.image)

  return CategoryTree.pathTo(tree, input.categorySlug)
}

export const createProduct = async (
  dependencies: CatalogAdminDependencies,
  input: Catalog.ProductInput,
): Promise<Catalog.Product> =>
  dependencies.productWriter.create(input, await productPlacement(dependencies, input))

export const updateProduct = async (
  dependencies: CatalogAdminDependencies,
  id: number,
  input: Catalog.ProductInput,
): Promise<void> => {
  if ((await dependencies.productWriter.findById(id)) === null) {
    throw new CatalogRuleViolation("Ce produit n'existe plus.")
  }
  await dependencies.productWriter.update(
    id,
    input,
    await productPlacement(dependencies, input, id),
  )
}

export const deleteProduct = async (
  dependencies: CatalogAdminDependencies,
  id: number,
): Promise<void> => {
  if ((await dependencies.productWriter.findById(id)) === null) {
    throw new CatalogRuleViolation("Ce produit n'existe plus.")
  }
  await dependencies.productWriter.remove(id)
}
