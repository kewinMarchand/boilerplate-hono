import { RuleViolation } from '#/shared/domain/ruleViolation.ts'

import type { Media } from './Media.ts'

/** Règles des images, mêmes valeurs et mêmes messages que l'API Platform (ADR 0002, 0008, 0010, 0011). */
export const MAX_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]

const WIDTHS: Record<Media.Usage, readonly [number, ...number[]]> = {
  article: [480, 960],
  product: [400, 640, 800],
  logo: [200, 400],
  share: [1200],
  icon: [32, 180, 192, 512],
}

/** null : pas de recadrage, les variantes gardent le ratio du fichier (logo, ADR 0005). */
const RATIOS: Record<Media.Usage, readonly [number, number] | null> = {
  article: [16, 9],
  product: [1, 1],
  logo: null,
  share: [40, 21],
  icon: [1, 1],
}

const PHOTO_FORMATS: readonly [Media.Format, ...Media.Format[]] = ['avif', 'webp']
const ICON_FORMATS: readonly [Media.Format, ...Media.Format[]] = ['png']

const KEY_PATTERN = /^[0-9a-f]{32}$/

/** Règle des images refusée : le message s'affiche dans l'admin, traduit dans la langue de son interface. */
export class MediaRuleViolation extends RuleViolation {
  constructor(template: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(template, parameters)
    this.name = 'MediaRuleViolation'
  }
}

/** Largeurs des variantes, de la plus petite à la plus grande. */
export const widthsOf = (usage: Media.Usage): readonly [number, ...number[]] => WIDTHS[usage]

export const ratioOf = (usage: Media.Usage): readonly [number, number] | null => RATIOS[usage]

export const largestWidth = (usage: Media.Usage): number => WIDTHS[usage].at(-1) ?? WIDTHS[usage][0]

/** Formats des variantes, dans l'ordre des sources du <picture> : PNG seul pour l'icône (ADR 0011). */
export const formatsOf = (usage: Media.Usage): readonly [Media.Format, ...Media.Format[]] =>
  usage === 'icon' ? ICON_FORMATS : PHOTO_FORMATS

/** Format lu par tous les navigateurs : celui de l'attribut src et des aperçus de l'admin. */
export const fallbackFormatOf = (usage: Media.Usage): Media.Format =>
  usage === 'icon' ? 'png' : 'webp'

/** Largeur minimale de la source, une fois recadrée : la plus grande variante, sauf pour les produits (ADR 0008). */
export const minimumWidth = (usage: Media.Usage): number =>
  usage === 'product' ? WIDTHS.product[0] : largestWidth(usage)

/**
 * Largeurs générées pour une source de cette largeur (recadrée) : celles de l'usage plus étroites que
 * la source, puis la plus grande, ramenée à la largeur de la source si elle la dépasse. Une source
 * n'est jamais agrandie (ADR 0008).
 */
export const widthsUpTo = (
  usage: Media.Usage,
  sourceWidth: number,
): readonly [number, ...number[]] => {
  const largest = Math.min(sourceWidth, largestWidth(usage))
  const [first, ...rest] = WIDTHS[usage].filter((width) => width < largest)
  return first === undefined ? [largest] : [first, ...rest, largest]
}

/** `sourceSize` : largeur et hauteur du fichier, requises pour un usage sans recadrage. */
export const heightFor = (
  usage: Media.Usage,
  width: number,
  sourceSize?: readonly [number, number],
): number => {
  const ratio = RATIOS[usage] ?? sourceSize
  if (ratio === undefined) {
    throw new Error(`L'usage ${usage} garde le ratio du fichier : ses dimensions sont requises.`)
  }
  const [ratioWidth, ratioHeight] = ratio
  return Math.max(1, Math.floor((width * ratioHeight) / ratioWidth))
}

export const fileName = (key: string, width: number, format: Media.Format): string =>
  `${key}-${width}.${format}`

export const image = (key: string, alt: string, height?: number, width?: number): Media.Image => {
  if (!KEY_PATTERN.test(key)) {
    throw new MediaRuleViolation("Empreinte d'image invalide : « %key% ».", { key })
  }
  return {
    key,
    alt: alt.trim(),
    ...(height === undefined ? {} : { height }),
    ...(width === undefined ? {} : { width }),
  }
}

export const isDecorative = (value: Media.Image): boolean => value.alt === ''

/** Texte de remplacement à enregistrer : vide pour une image décorative, obligatoire sinon (RGAA 1.1 à 1.3). */
export const altOf = (alt: string, decorative: boolean): string => {
  if (decorative) {
    return ''
  }
  const trimmed = alt.trim()
  if (trimmed === '') {
    throw new MediaRuleViolation(
      'Le texte de remplacement est obligatoire, sauf pour une image décorative.',
    )
  }
  return trimmed
}

/**
 * Contrôle de forme d'un fichier envoyé, une fois lu par l'encodeur. Rend la largeur de la source
 * une fois recadrée (sa largeur pour un usage sans recadrage).
 */
export const checkSource = (
  size: number,
  source: Media.Source | null,
  usage: Media.Usage,
): number => {
  if (size > MAX_BYTES) {
    throw new MediaRuleViolation("L'image pèse plus de 10 Mo.")
  }
  if (source === null) {
    throw new MediaRuleViolation('Le fichier ne se lit pas comme une image.')
  }
  if (!ACCEPTED_TYPES.includes(source.mimeType)) {
    throw new MediaRuleViolation('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  }
  const minimum = minimumWidth(usage)
  const ratio = RATIOS[usage]
  if (ratio === null) {
    if (source.width < minimum) {
      throw new MediaRuleViolation(
        "L'image doit faire au moins %min% px de large : elle fait %width% × %height% px.",
        { min: minimum, width: source.width, height: source.height },
      )
    }
    return source.width
  }
  const [ratioWidth, ratioHeight] = ratio
  const croppedWidth = Math.min(
    source.width,
    Math.floor((source.height * ratioWidth) / ratioHeight),
  )
  if (croppedWidth < minimum) {
    throw new MediaRuleViolation(
      "Recadrée au format %ratioWidth%:%ratioHeight%, l'image doit faire au moins %minWidth% × %minHeight% px : elle fait %width% × %height% px.",
      {
        ratioWidth,
        ratioHeight,
        minWidth: minimum,
        minHeight: heightFor(usage, minimum),
        width: source.width,
        height: source.height,
      },
    )
  }
  return croppedWidth
}
