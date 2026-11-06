import { CatalogRuleViolation, checkPlacement } from '#/catalog/domain/catalogRules.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { changeImage } from '#/media/application/storeImage.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { MediaDependencies } from '#/media/application/storeImage.ts'

/**
 * Écritures de l'admin sur le catalogue (ADR 0001) : chaque cas d'usage vérifie les règles qui
 * consultent les autres objets (unicité, existence, suppression), puis enregistre par les ports.
 * Mêmes vérifications, dans le même ordre et avec les mêmes messages que l'API Platform.
 */
export interface CatalogAdminDependencies {
  readonly categories: Catalog.CategoryRepository
  readonly categoryWriter: Catalog.CategoryWriter
  readonly productWriter: Catalog.ProductWriter
  readonly media: MediaDependencies
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

  return CategoryTree.pathTo(tree, input.categorySlug)
}

/** Produit à enregistrer : sans texte de remplacement, il prend son nom (MediaRuleViolation si l'image est refusée). */
const savedProduct = async (
  { media }: CatalogAdminDependencies,
  input: Catalog.ProductInput,
  current: Catalog.Product | null,
): Promise<Catalog.ProductSaved> => {
  const { imageContent, imageAlt, imageDecorative, ...product } = input
  const alt = imageAlt.trim() === '' ? input.name : imageAlt
  const image = await changeImage(
    media,
    current?.image ?? null,
    imageContent,
    alt,
    imageDecorative,
    'product',
  )
  if (image === null) {
    throw new CatalogRuleViolation("Un produit a besoin d'une image.")
  }
  return { ...product, image }
}

export const createProduct = async (
  dependencies: CatalogAdminDependencies,
  input: Catalog.ProductInput,
): Promise<Catalog.Product> => {
  const categoryPath = await productPlacement(dependencies, input)
  return dependencies.productWriter.create(
    await savedProduct(dependencies, input, null),
    categoryPath,
  )
}

export const updateProduct = async (
  dependencies: CatalogAdminDependencies,
  id: number,
  input: Catalog.ProductInput,
): Promise<void> => {
  const current = await dependencies.productWriter.findById(id)
  if (current === null) {
    throw new CatalogRuleViolation("Ce produit n'existe plus.")
  }
  const categoryPath = await productPlacement(dependencies, input, id)
  await dependencies.productWriter.update(
    id,
    await savedProduct(dependencies, input, current),
    categoryPath,
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
