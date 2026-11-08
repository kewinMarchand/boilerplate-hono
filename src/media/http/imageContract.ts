import { z } from 'zod'

import { audioFileName } from '#/media/domain/audioRules.ts'
import {
  fallbackFormatOf,
  fileName,
  formatsOf,
  heightFor,
  largestWidth,
  widthsUpTo,
} from '#/media/domain/imageRules.ts'

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

export const audioViewContract = z
  .object({
    src: z.string().meta({ description: 'Adresse absolue du fichier, immuable.' }),
    type: z.enum(['audio/mpeg', 'audio/mp4', 'audio/ogg']).meta({
      description: "Type MIME, lu dans le contenu à l'envoi.",
    }),
    durationSeconds: z.int().meta({ description: "Durée en secondes, arrondie, lue à l'envoi." }),
  })
  .meta({ id: 'AudioView', description: 'Fichier audio exposé dans le contrat public (ADR 0009).' })

export type AudioView = z.infer<typeof audioViewContract>

/** Sources du <picture> : les photos seulement, l'icône du site (PNG) a son propre contrat. */
const SOURCE_MIME: Partial<Record<Media.Format, 'image/avif' | 'image/webp'>> = {
  avif: 'image/avif',
  webp: 'image/webp',
}

const AUDIO_MIME: Record<Media.AudioFormat, AudioView['type']> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

/** Adresse absolue d'un fichier de /media/. */
export const mediaUrl = (baseUrl: string, name: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/media/${name}`

/**
 * Image du contrat. `baseUrl` est l'origine publique de l'API (MEDIA_BASE_URL), vue par le
 * navigateur : les adresses sont absolues, puisque les fronts ne sont pas servis par l'API.
 */
export const imageView = (baseUrl: string, image: Media.Image, usage: Media.Usage): ImageView => {
  const url = (width: number, format: Media.Format) =>
    mediaUrl(baseUrl, fileName(image.key, width, format))
  const widths = widthsUpTo(usage, image.width ?? largestWidth(usage))
  const largest = widths.at(-1) ?? widths[0]

  return {
    alt: image.alt,
    width: largest,
    height: image.height ?? heightFor(usage, largest),
    sources: formatsOf(usage).flatMap((format) => {
      const type = SOURCE_MIME[format]
      return type === undefined
        ? []
        : [{ type, srcset: widths.map((width) => `${url(width, format)} ${width}w`).join(', ') }]
    }),
    src: url(widths[0], fallbackFormatOf(usage)),
  }
}

/** Image du contrat, null sans image. */
export const toImageView = (
  baseUrl: string,
  image: Media.Image | null,
  usage: Media.Usage,
): ImageView | null => (image === null ? null : imageView(baseUrl, image, usage))

/** Fichier audio du contrat, servi tel quel sous /media/. */
export const toAudioView = (baseUrl: string, audio: Media.Audio | null): AudioView | null =>
  audio === null
    ? null
    : {
        src: mediaUrl(baseUrl, audioFileName(audio)),
        type: AUDIO_MIME[audio.format],
        durationSeconds: audio.durationSeconds,
      }
