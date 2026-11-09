import { SiteRuleViolation } from './SiteIdentity.ts'

/**
 * Couleurs opaques #rrggbb, en minuscules. Mélange et contraste suivent maquettes-sites/chartes.py
 * (melange, luminance, contraste), arrondi au pair compris, comme HexColor de l'API Platform : les
 * deux API et les maquettes donnent les mêmes valeurs.
 */
const PATTERN = /^#[0-9a-f]{6}$/

/** Couleur saisie, nettoyée et vérifiée. */
export const hexColor = (value: string): string => {
  const color = value.trim().toLowerCase()
  if (!PATTERN.test(color)) {
    throw new SiteRuleViolation('Couleur invalide : « %value% ». Format attendu : #rrggbb.', {
      value: color,
    })
  }
  return color
}

const channels = (color: string): [number, number, number] => [
  Number.parseInt(color.slice(1, 3), 16),
  Number.parseInt(color.slice(3, 5), 16),
  Number.parseInt(color.slice(5, 7), 16),
]

/** Arrondi au pair de la valeur exacte du flottant, comme round() de Python et PHP_ROUND_HALF_EVEN. */
const roundHalfEven = (value: number): number => {
  const floor = Math.floor(value)
  const fraction = value - floor
  if (fraction === 0.5) {
    return floor % 2 === 0 ? floor : floor + 1
  }
  return fraction < 0.5 ? floor : floor + 1
}

/** `otherPart` : part de `other` dans le mélange, de 0 à 1. */
export const mix = (color: string, other: string, otherPart: number): string => {
  const theirs = channels(other)
  return `#${channels(color)
    .map((own, index) =>
      Math.max(
        0,
        Math.min(255, roundHalfEven(own * (1 - otherPart) + (theirs[index] ?? 0) * otherPart)),
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

const luminance = (color: string): number => {
  const [red, green, blue] = channels(color).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

/** Rapport de contraste WCAG, de 1 à 21. */
export const contrast = (first: string, second: string): number => {
  const lighter = Math.max(luminance(first), luminance(second))
  const darker = Math.min(luminance(first), luminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}
