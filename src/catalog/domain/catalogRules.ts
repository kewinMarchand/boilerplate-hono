import { RuleViolation } from '#/shared/domain/ruleViolation.ts'

import { MAX_GALLERY_IMAGES } from './catalog.ts'
import { CategoryTree } from './categoryTree.ts'

/** Règles d'écriture du catalogue, mêmes messages que l'API Platform (ADR 0001 des deux dépôts). */
export const MAX_DEPTH = 3

/** Règle du catalogue refusée : le message s'affiche dans l'admin, traduit dans la langue de son interface. */
export class CatalogRuleViolation extends RuleViolation {
  constructor(template: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(template, parameters)
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
      'Le catalogue a %max% niveaux au plus : cette place en donnerait %depth%.',
      { max: MAX_DEPTH, depth },
    )
  }
}

/** Galerie d'un produit : 8 images au plus (ADR 0008), comptées avant tout encodage. */
export const checkGallerySize = (count: number): void => {
  if (count > MAX_GALLERY_IMAGES) {
    throw new CatalogRuleViolation('La galerie compte %max% images au plus (%count% demandées).', {
      max: MAX_GALLERY_IMAGES,
      count,
    })
  }
}
