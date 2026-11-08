import { contrast, mix } from './hexColor.ts'

/**
 * Couleurs de marque d'un thème : les douze jetons de boilerplates-ui, calculés depuis les couleurs
 * principale et secondaire (SPEC-COMMUNE, section 22), mêmes règles que BrandPalette et
 * ColorShades de l'API Platform.
 */
export const LIGHT_BACKGROUND = '#ffffff'
export const DARK_BACKGROUND = '#0f141d'
export const DARK_CONTRAST = 7

const BLACK = '#000000'
const WHITE = '#ffffff'
const DARK_TEXT = '#111827'
const DARK_PART = 0.25
const LIGHTENING_STEP = 0.05

/** Déclinaisons d'une couleur : elle-même, sa variante -dark, le texte lisible dessus et trois surfaces teintées. */
export interface ColorShades {
  readonly color: string
  readonly dark: string
  readonly on: string
  readonly surfaceSubtle: string
  readonly surface: string
  readonly surfaceStrong: string
}

export interface BrandPalette {
  readonly primary: ColorShades
  readonly secondary: ColorShades
}

/** Blanc ou quasi-noir, celui qui contraste le plus ; blanc à égalité. */
const textOn = (color: string): string =>
  contrast(color, DARK_TEXT) > contrast(color, WHITE) ? DARK_TEXT : WHITE

/**
 * Règles des chartes des maquettes (maquettes-sites/chartes.py, declinaisons) : -dark à 25 % de
 * noir, texte blanc ou quasi-noir, surfaces à 8, 18 et 32 %.
 */
const lightShades = (color: string): ColorShades => ({
  color,
  dark: mix(color, BLACK, DARK_PART),
  on: textOn(color),
  surfaceSubtle: mix(LIGHT_BACKGROUND, color, 0.08),
  surface: mix(LIGHT_BACKGROUND, color, 0.18),
  surfaceStrong: mix(LIGHT_BACKGROUND, color, 0.32),
})

/**
 * Règles des jetons sombres de boilerplates-ui, pour une couleur déjà éclaircie : -dark à 25 % de
 * blanc, texte de la couleur du fond, surfaces à 8, 12 et 19 %.
 */
const darkShades = (color: string): ColorShades => ({
  color,
  dark: mix(color, WHITE, DARK_PART),
  on: DARK_BACKGROUND,
  surfaceSubtle: mix(DARK_BACKGROUND, color, 0.08),
  surface: mix(DARK_BACKGROUND, color, 0.12),
  surfaceStrong: mix(DARK_BACKGROUND, color, 0.19),
})

/**
 * Éclaircit par pas de 5 % de blanc jusqu'à 7:1 sur le fond sombre. Le blanc pur y dépasse 7:1 :
 * la boucle s'arrête au plus tard au vingtième pas.
 */
const readableOnDark = (color: string): string => {
  for (let step = 0; ; step++) {
    const lightened = mix(color, WHITE, step * LIGHTENING_STEP)
    if (contrast(lightened, DARK_BACKGROUND) >= DARK_CONTRAST) {
      return lightened
    }
  }
}

export const lightPalette = (primary: string, secondary: string): BrandPalette => ({
  primary: lightShades(primary),
  secondary: lightShades(secondary),
})

export const darkPalette = (primary: string, secondary: string): BrandPalette => ({
  primary: darkShades(readableOnDark(primary)),
  secondary: darkShades(readableOnDark(secondary)),
})
