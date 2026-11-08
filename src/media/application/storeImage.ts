import {
  altOf,
  checkSource,
  fileName,
  formatsOf,
  heightFor,
  image,
  largestWidth,
  ratioOf,
  widthsUpTo,
} from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'

export interface MediaDependencies {
  readonly encoder: Media.Encoder
  readonly audioInspector: Media.AudioInspector
  readonly storage: Media.Storage
  /**
   * Empreinte du contenu : sha256(usage + "\n" + contenu) pour une image, sha256("audio\n" + contenu)
   * pour un fichier audio, tronquée (même valeur que PHP).
   */
  readonly fingerprint: (scope: Media.Usage | 'audio', content: Uint8Array) => string
}

const isStored = async (
  { storage }: MediaDependencies,
  key: string,
  usage: Media.Usage,
  widths: readonly number[],
): Promise<boolean> => {
  for (const width of widths) {
    for (const format of formatsOf(usage)) {
      if (!(await storage.has(fileName(key, width, format)))) {
        return false
      }
    }
  }
  return true
}

/**
 * Contrôle un fichier envoyé, génère ses variantes et les stocke (ADR 0002), sans jamais agrandir la
 * source (ADR 0008). Le même contenu pour le même usage donne la même empreinte : ses variantes déjà
 * stockées ne sont pas réencodées.
 */
export const storeImage = async (
  dependencies: MediaDependencies,
  upload: Media.Upload,
  usage: Media.Usage,
): Promise<Media.Image> => {
  const alt = altOf(upload.alt, upload.decorative)
  const source = await dependencies.encoder.inspect(upload.content)
  const croppedWidth = checkSource(upload.content.byteLength, source, usage)
  const widths = widthsUpTo(usage, croppedWidth)
  const largest = widths.at(-1) ?? widths[0]

  const key = dependencies.fingerprint(usage, upload.content)
  if (!(await isStored(dependencies, key, usage, widths))) {
    const variants = await dependencies.encoder.variants(upload.content, key, usage, widths)
    for (const [name, content] of variants) {
      await dependencies.storage.put(name, content)
    }
  }

  return image(
    key,
    alt,
    ratioOf(usage) === null && source !== null
      ? heightFor(usage, largest, [source.width, source.height])
      : undefined,
    largest < largestWidth(usage) ? largest : undefined,
  )
}

/**
 * Image d'un objet après une saisie de l'admin : le fichier envoyé s'il y en a un, sinon l'image
 * actuelle avec son nouveau texte de remplacement.
 */
export const changeImage = async (
  dependencies: MediaDependencies,
  current: Media.Image | null,
  content: Uint8Array | null,
  alt: string,
  decorative: boolean,
  usage: Media.Usage,
): Promise<Media.Image | null> => {
  if (content !== null) {
    return storeImage(dependencies, { content, alt, decorative }, usage)
  }
  return current === null
    ? null
    : image(current.key, altOf(alt, decorative), current.height, current.width)
}
