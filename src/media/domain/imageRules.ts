import type { Media } from './Media.ts'

/** Règles des images, mêmes valeurs et mêmes messages que l'API Platform (ADR 0002). */
export const MAX_BYTES = 10 * 1024 * 1024
export const ACCEPTED_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]
export const FORMATS: readonly Media.Format[] = ['avif', 'webp']

const WIDTHS: Record<Media.Usage, readonly [number, ...number[]]> = {
  article: [480, 960],
  product: [400, 640, 800],
  logo: [200, 400],
}

/** null : pas de recadrage, les variantes gardent le ratio du fichier (logo, ADR 0005). */
const RATIOS: Record<Media.Usage, readonly [number, number] | null> = {
  article: [16, 9],
  product: [1, 1],
  logo: null,
}

const KEY_PATTERN = /^[0-9a-f]{32}$/

/** Règle des images refusée : le message est montré tel quel dans l'admin. */
export class MediaRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaRuleViolation'
  }
}

/** Largeurs des variantes, de la plus petite à la plus grande. */
export const widthsOf = (usage: Media.Usage): readonly [number, ...number[]] => WIDTHS[usage]

export const ratioOf = (usage: Media.Usage): readonly [number, number] | null => RATIOS[usage]

export const largestWidth = (usage: Media.Usage): number => WIDTHS[usage].at(-1) ?? WIDTHS[usage][0]

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

export const image = (key: string, alt: string, height?: number): Media.Image => {
  if (!KEY_PATTERN.test(key)) {
    throw new MediaRuleViolation(`Empreinte d'image invalide : « ${key} ».`)
  }
  return height === undefined ? { key, alt: alt.trim() } : { key, alt: alt.trim(), height }
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

/** Contrôle de forme d'un fichier envoyé, une fois lu par l'encodeur. */
export const checkSource = (
  size: number,
  source: Media.Source | null,
  usage: Media.Usage,
): void => {
  if (size > MAX_BYTES) {
    throw new MediaRuleViolation("L'image pèse plus de 10 Mo.")
  }
  if (source === null) {
    throw new MediaRuleViolation('Le fichier ne se lit pas comme une image.')
  }
  if (!ACCEPTED_TYPES.includes(source.mimeType)) {
    throw new MediaRuleViolation('Formats acceptés : JPEG, PNG, WebP ou AVIF.')
  }
  const largest = largestWidth(usage)
  const ratio = RATIOS[usage]
  if (ratio === null) {
    if (source.width < largest) {
      throw new MediaRuleViolation(
        `L'image doit faire au moins ${largest} px de large : elle fait ${source.width} × ${source.height} px.`,
      )
    }
    return
  }
  const [ratioWidth, ratioHeight] = ratio
  const croppedWidth = Math.min(
    source.width,
    Math.floor((source.height * ratioWidth) / ratioHeight),
  )
  if (croppedWidth < largest) {
    throw new MediaRuleViolation(
      `Recadrée au format ${ratioWidth}:${ratioHeight}, l'image doit faire au moins ${largest} × ${heightFor(usage, largest)} px : elle fait ${source.width} × ${source.height} px.`,
    )
  }
}
