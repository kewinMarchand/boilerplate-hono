import { describe, expect, it } from 'vitest'

import { MAX_BYTES } from '#/media/domain/imageRules.ts'
import { storeImage } from '#/media/application/storeImage.ts'

import { fakeMedia, photo } from './fakeMedia.ts'

const upload = (description: string, alt = 'Une photo', decorative = false) => ({
  content: photo(description),
  alt,
  decorative,
})

describe('storeImage', () => {
  it('stocke chaque variante de l’usage, texte de remplacement nettoyé', async () => {
    const { media, files } = fakeMedia()

    const image = await storeImage(media, upload('image/jpeg 1600x900', ' Fleur rouge '), 'article')

    expect(image.alt).toBe('Fleur rouge')
    expect([...files.keys()]).toEqual([
      `${image.key}-480.avif`,
      `${image.key}-480.webp`,
      `${image.key}-960.avif`,
      `${image.key}-960.webp`,
    ])
  })

  it('n’encode qu’une fois le même contenu pour le même usage', async () => {
    const { media, encodings } = fakeMedia()

    const first = await storeImage(media, upload('image/png 800x800', 'A'), 'product')
    const second = await storeImage(media, upload('image/png 800x800', 'B'), 'product')

    expect(second.key).toBe(first.key)
    expect(encodings()).toBe(1)
  })

  it('donne une autre empreinte au même contenu pour un autre usage', async () => {
    const { media } = fakeMedia()

    const product = await storeImage(media, upload('image/jpeg 1600x1600'), 'product')
    const article = await storeImage(media, upload('image/jpeg 1600x1600'), 'article')

    expect(article.key).not.toBe(product.key)
  })

  it('accepte une image décorative, sans texte de remplacement', async () => {
    const image = await storeImage(
      fakeMedia().media,
      upload('image/webp 960x540', 'Ignoré', true),
      'article',
    )

    expect(image.alt).toBe('')
  })

  it.each([
    [
      upload('image/jpeg 1600x900', '  '),
      'Le texte de remplacement est obligatoire, sauf pour une image décorative.',
    ],
    [upload(`image/jpeg 1600x900${'x'.repeat(MAX_BYTES)}`), "L'image pèse plus de 10 Mo."],
    [upload('%PDF-1.7'), 'Le fichier ne se lit pas comme une image.'],
    [upload('image/gif 1600x900'), 'Formats acceptés : JPEG, PNG, WebP ou AVIF.'],
    [
      upload('image/jpeg 959x540'),
      "Recadrée au format 16:9, l'image doit faire au moins 960 × 540 px : elle fait 959 × 540 px.",
    ],
    [
      upload('image/jpeg 2000x530'),
      "Recadrée au format 16:9, l'image doit faire au moins 960 × 540 px : elle fait 2000 × 530 px.",
    ],
  ])(
    'refuse un envoi qui enfreint une règle, avec le message de l’API Platform',
    async (input, message) => {
      await expect(storeImage(fakeMedia().media, input, 'article')).rejects.toThrow(message)
    },
  )
})
