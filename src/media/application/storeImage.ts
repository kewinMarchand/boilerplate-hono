import {
  altOf,
  checkSource,
  fileName,
  FORMATS,
  heightFor,
  image,
  largestWidth,
  ratioOf,
  widthsOf,
} from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'

export interface MediaDependencies {
  readonly encoder: Media.Encoder
  readonly storage: Media.Storage
  /** Empreinte du contenu pour un usage : sha256(usage + "\n" + contenu), tronquée (même valeur que PHP). */
  readonly fingerprint: (usage: Media.Usage, content: Uint8Array) => string
}

const isStored = async (
  { storage }: MediaDependencies,
  key: string,
  usage: Media.Usage,
): Promise<boolean> => {
  for (const width of widthsOf(usage)) {
    for (const format of FORMATS) {
      if (!(await storage.has(fileName(key, width, format)))) {
        return false
      }
    }
  }
  return true
}

/**
 * Contrôle un fichier envoyé, génère ses variantes et les stocke (ADR 0002). Le même contenu pour le
 * même usage donne la même empreinte : ses variantes déjà stockées ne sont pas réencodées.
 */
export const storeImage = async (
  dependencies: MediaDependencies,
  upload: Media.Upload,
  usage: Media.Usage,
): Promise<Media.Image> => {
  const alt = altOf(upload.alt, upload.decorative)
  const source = await dependencies.encoder.inspect(upload.content)
  checkSource(upload.content.byteLength, source, usage)

  const key = dependencies.fingerprint(usage, upload.content)
  if (!(await isStored(dependencies, key, usage))) {
    const variants = await dependencies.encoder.variants(upload.content, key, usage)
    for (const [name, content] of variants) {
      await dependencies.storage.put(name, content)
    }
  }

  return ratioOf(usage) === null && source !== null
    ? image(key, alt, heightFor(usage, largestWidth(usage), [source.width, source.height]))
    : image(key, alt)
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
  return current === null ? null : image(current.key, altOf(alt, decorative), current.height)
}
