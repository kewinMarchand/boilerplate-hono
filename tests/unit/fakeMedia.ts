import { fileName, FORMATS, widthsOf } from '#/media/domain/imageRules.ts'
import { fingerprint } from '#/media/infrastructure/sharpImageEncoder.ts'

import type { MediaDependencies } from '#/media/application/storeImage.ts'
import type { Media } from '#/media/domain/Media.ts'

/** Contenu accepté pour tous les usages par l'encodeur factice : « type largeurxhauteur ». */
export const PHOTO = new TextEncoder().encode('image/jpeg 1600x1600')

export const photo = (description: string): Uint8Array => new TextEncoder().encode(description)

export const testImage = (alt = 'Photo', key = 'a'.repeat(32)): Media.Image => ({ key, alt })

/** Médias sans sharp ni disque : le contenu décrit l'image, les variantes restent en mémoire. */
export const fakeMedia = () => {
  const files = new Map<string, Uint8Array>()
  let encodings = 0
  const media: MediaDependencies = {
    encoder: {
      inspect: (content) => {
        const match = /^(image\/[a-z]+) (\d+)x(\d+)/.exec(new TextDecoder().decode(content))
        return Promise.resolve(
          match === null
            ? null
            : { mimeType: match[1] ?? '', width: Number(match[2]), height: Number(match[3]) },
        )
      },
      variants: (_content, key, usage) => {
        encodings += 1
        const variants = new Map<string, Uint8Array>()
        for (const width of widthsOf(usage)) {
          for (const format of FORMATS) {
            variants.set(fileName(key, width, format), new TextEncoder().encode(format))
          }
        }
        return Promise.resolve(variants)
      },
    },
    storage: {
      has: (name) => Promise.resolve(files.has(name)),
      put: (name, content) => {
        files.set(name, content)
        return Promise.resolve()
      },
    },
    fingerprint,
  }

  return { media, files, encodings: () => encodings }
}
