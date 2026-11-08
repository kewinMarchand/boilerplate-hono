import { z } from 'zod'

import { fileName, FORMATS, heightFor, largestWidth, widthsOf } from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'

export const imageSourceContract = z
  .object({
    type: z.enum(['image/avif', 'image/webp']).meta({
      description: 'Type MIME de la source : image/avif, puis image/webp.',
    }),
    srcset: z.string().meta({
      description:
        "Valeur de l'attribut srcset : adresses absolues et largeurs, de la plus petite à la plus grande.",
    }),
  })
  .meta({
    id: 'ImageSource',
    description: "Une source d'un élément <picture> : un format et toutes ses largeurs.",
  })

export const imageViewContract = z
  .object({
    alt: z.string().meta({ description: 'Texte de remplacement. Vide : image décorative.' }),
    width: z.int().meta({
      description: 'Largeur de la plus grande variante, en pixels (attribut width).',
    }),
    height: z.int().meta({
      description: 'Hauteur de la plus grande variante, en pixels (attribut height).',
    }),
    sources: z
      .array(imageSourceContract)
      .meta({ description: 'Sources du <picture>, AVIF puis WebP.' }),
    src: z.string().meta({
      description: "Adresse absolue de la plus petite variante WebP (attribut src de l'<img>).",
    }),
  })
  .meta({
    id: 'ImageView',
    description:
      'Image exposée dans le contrat public (ADR 0002) : les fronts posent les sources dans un <picture>, sans construire aucun chemin.',
  })

export type ImageView = z.infer<typeof imageViewContract>

const MIME: Record<Media.Format, 'image/avif' | 'image/webp'> = {
  avif: 'image/avif',
  webp: 'image/webp',
}

/**
 * Image du contrat. `baseUrl` est l'origine publique de l'API (MEDIA_BASE_URL), vue par le
 * navigateur : les adresses sont absolues, puisque les fronts ne sont pas servis par l'API.
 */
export const toImageView = (
  baseUrl: string,
  image: Media.Image | null,
  usage: Media.Usage,
): ImageView | null => {
  if (image === null) {
    return null
  }
  const media = `${baseUrl.replace(/\/+$/, '')}/media/`
  const url = (width: number, format: Media.Format) => media + fileName(image.key, width, format)
  const widths = widthsOf(usage)
  const largest = largestWidth(usage)

  return {
    alt: image.alt,
    width: largest,
    height: image.height ?? heightFor(usage, largest),
    sources: FORMATS.map((format) => ({
      type: MIME[format],
      srcset: widths.map((width) => `${url(width, format)} ${width}w`).join(', '),
    })),
    src: url(widths[0], 'webp'),
  }
}
