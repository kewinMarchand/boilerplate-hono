import { categoryIn } from './catalogTranslations.ts'
import { CategoryNotFoundError } from './CategoryNotFoundError.ts'

import type { Catalog } from './catalog.ts'

/** L'arbre des catégories du catalogue, valeur immuable. La racine est représentée par null. */
export interface CategoryTree {
  readonly categories: readonly Catalog.Category[]
}

const byPosition = (a: Catalog.Category, b: Catalog.Category): number => a.position - b.position

const childrenOf = (tree: CategoryTree, parent: Catalog.Category | null): Catalog.Category[] =>
  tree.categories
    .filter((category) => category.parent === (parent?.slug ?? null))
    .toSorted(byPosition)

/** `locale` : langue du slug (le sien, ou celui de la langue par défaut s'il n'est pas traduit) ; null : la langue par défaut. */
const find = (tree: CategoryTree, slug: string, locale: string | null = null): Catalog.Category => {
  const category = tree.categories.find((candidate) => categoryIn(candidate, locale).slug === slug)
  if (category === undefined) {
    throw new CategoryNotFoundError(slug)
  }

  return category
}

/** Slugs de la racine jusqu'à la catégorie incluse : dénormalisé sur chaque produit. */
const pathTo = (tree: CategoryTree, slug: string): string[] => {
  const path: string[] = []
  for (let current: string | null = slug; current !== null;) {
    const category = find(tree, current)
    path.unshift(category.slug)
    current = category.parent
  }

  return path
}

/** Niveaux sous la catégorie : 0 sans sous-catégorie. Ils descendent avec elle quand elle bouge. */
const levelsBelow = (tree: CategoryTree, slug: string): number =>
  tree.categories
    .filter((category) => category.parent === slug)
    .reduce((deepest, child) => Math.max(deepest, 1 + levelsBelow(tree, child.slug)), 0)

/** La catégorie et toutes ses sous-catégories, à toute profondeur. */
const branch = (tree: CategoryTree, slug: string): string[] => [
  slug,
  ...tree.categories
    .filter((category) => category.parent === slug)
    .flatMap((child) => branch(tree, child.slug)),
]

export const CategoryTree = {
  of: (categories: readonly Catalog.Category[]): CategoryTree => ({
    categories: Object.freeze(categories.toSorted(byPosition)),
  }),
  find,
  childrenOf,
  pathTo,
  levelsBelow,
  branch,
}
