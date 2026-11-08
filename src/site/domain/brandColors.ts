import { LIGHT_BACKGROUND, lightPalette } from './brandPalette.ts'
import { contrast, hexColor } from './hexColor.ts'
import { SiteRuleViolation } from './SiteIdentity.ts'

import type { SiteIdentity } from './SiteIdentity.ts'

/**
 * Règles des couleurs de marque, mêmes messages que BrandColors de l'API Platform. La principale
 * sert de couleur de lien : elle doit contraster à 4,5:1 avec le fond clair. La secondaire doit
 * porter un texte lisible (on-secondary à 4,5:1).
 */
export const MIN_CONTRAST = 4.5

/** Tronqué à deux décimales : un ratio sous le seuil ne s'affiche jamais « 4,50 ». */
const ratio = (value: number): string =>
  (Math.floor(value * 100) / 100).toFixed(2).replace('.', ',')

export const brandColors = (primary: string, secondary: string): SiteIdentity.Colors => {
  const onLight = contrast(primary, LIGHT_BACKGROUND)
  if (onLight < MIN_CONTRAST) {
    throw new SiteRuleViolation(
      `La couleur principale doit contraster à 4,5:1 au moins avec le fond clair (actuellement ${ratio(onLight)}:1).`,
    )
  }
  const text = contrast(lightPalette(primary, secondary).secondary.on, secondary)
  if (text < MIN_CONTRAST) {
    throw new SiteRuleViolation(
      `La couleur secondaire ne permet pas de texte lisible dessus (au mieux ${ratio(text)}:1, 4,5:1 au minimum).`,
    )
  }
  return { primary, secondary }
}

/** Saisie de l'admin : les deux couleurs ou aucune (null : le front garde les jetons de boilerplates-ui). */
export const brandColorsFromInput = (
  primary: string,
  secondary: string,
): SiteIdentity.Colors | null => {
  const trimmedPrimary = primary.trim()
  const trimmedSecondary = secondary.trim()
  if (trimmedPrimary === '' && trimmedSecondary === '') {
    return null
  }
  if (trimmedPrimary === '' || trimmedSecondary === '') {
    throw new SiteRuleViolation('Saisir les deux couleurs, ou aucune.')
  }
  return brandColors(hexColor(trimmedPrimary), hexColor(trimmedSecondary))
}
