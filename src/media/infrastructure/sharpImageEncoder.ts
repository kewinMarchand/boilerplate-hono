import { createHash } from 'node:crypto'
import sharp from 'sharp'

import { fileName, FORMATS, heightFor, widthsOf } from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'

/** Mêmes réglages que l'encodeur GD de l'API Platform (poids mesurés égaux aux visuels de shared-assets). */
const AVIF_QUALITY = 50
const WEBP_QUALITY = 75

const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

/** Orientations EXIF qui échangent largeur et hauteur. */
const TRANSPOSED = new Set([5, 6, 7, 8])

/** Empreinte du contenu pour un usage, identique à celle de StoreImage côté PHP. */
export const fingerprint = (usage: Media.Usage, content: Uint8Array): string =>
  createHash('sha256').update(`${usage}\n`).update(content).digest('hex').slice(0, 32)

const mimeTypeOf = (metadata: sharp.Metadata): string | null => {
  if (metadata.format === 'heif') {
    return metadata.compression === 'av1' ? 'image/avif' : 'image/heic'
  }
  return MIME_TYPES[metadata.format] ?? `image/${metadata.format}`
}

const inspect = async (content: Uint8Array): Promise<Media.Source | null> => {
  try {
    const metadata = await sharp(content).metadata()
    const mimeType = mimeTypeOf(metadata)
    if (mimeType === null || metadata.width < 1 || metadata.height < 1) {
      return null
    }
    const transposed = TRANSPOSED.has(metadata.orientation ?? 1)

    return {
      mimeType,
      width: transposed ? metadata.height : metadata.width,
      height: transposed ? metadata.width : metadata.height,
    }
  } catch {
    return null
  }
}

/**
 * Encodeur sharp (libvips). L'orientation EXIF est appliquée (`rotate()`), et sharp n'écrit aucune
 * métadonnée du fichier envoyé (EXIF, GPS, profil) dans les variantes. La transparence est gardée
 * (PNG, WebP, AVIF) : un usage sans recadrage (logo) garde le ratio du fichier.
 */
export const sharpImageEncoder: Media.Encoder = {
  inspect,

  async variants(content, key, usage) {
    const source = await inspect(content)
    const sourceSize = source === null ? undefined : ([source.width, source.height] as const)
    const variants = new Map<string, Uint8Array>()
    for (const width of widthsOf(usage)) {
      const resized = sharp(content)
        .rotate()
        .resize(width, heightFor(usage, width, sourceSize), { fit: 'cover', position: 'centre' })
      for (const format of FORMATS) {
        const output =
          format === 'avif'
            ? resized.clone().avif({ quality: AVIF_QUALITY })
            : resized.clone().webp({ quality: WEBP_QUALITY })
        variants.set(fileName(key, width, format), new Uint8Array(await output.toBuffer()))
      }
    }

    return variants
  },
}
