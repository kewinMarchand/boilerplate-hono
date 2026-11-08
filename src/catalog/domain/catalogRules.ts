import { MAX_GALLERY_IMAGES } from './catalog.ts'
import { CategoryTree } from './categoryTree.ts'

/** Règles d'écriture du catalogue, mêmes messages que l'API Platform (ADR 0001 des deux dépôts). */
export const MAX_DEPTH = 3

/** Règle du catalogue refusée : le message est montré tel quel dans l'admin. */
export class CatalogRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogRuleViolation'
  }
}

/**
 * Place d'une catégorie (null : catégorie nouvelle) sous `parent` (null : racine) : ni sous
 * elle-même ou une de ses sous-catégories, ni au-delà de MAX_DEPTH niveaux, sous-arbre compris.
 */
export const checkPlacement = (
  tree: CategoryTree,
  category: string | null,
  parent: string | null,
): void => {
  const parentPath = parent === null ? [] : CategoryTree.pathTo(tree, parent)
  if (category !== null && parentPath.includes(category)) {
    throw new CatalogRuleViolation(
      'Une catégorie ne peut pas être rangée sous elle-même ou sous une de ses sous-catégories.',
    )
  }
  const depth =
    parentPath.length + 1 + (category === null ? 0 : CategoryTree.levelsBelow(tree, category))
  if (depth > MAX_DEPTH) {
    throw new CatalogRuleViolation(
      `Le catalogue a ${MAX_DEPTH} niveaux au plus : cette place en donnerait ${depth}.`,
    )
  }
}

/** Galerie d'un produit : 8 images au plus (ADR 0008), comptées avant tout encodage. */
export const checkGallerySize = (count: number): void => {
  if (count > MAX_GALLERY_IMAGES) {
    throw new CatalogRuleViolation(
      `La galerie compte ${MAX_GALLERY_IMAGES} images au plus (${count} demandées).`,
    )
  }
}
