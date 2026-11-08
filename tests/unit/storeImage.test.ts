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

  it('garde le ratio du fichier pour un logo', async () => {
    const { media, files } = fakeMedia()

    const image = await storeImage(media, upload('image/png 1000x300', 'Oraki'), 'logo')

    expect(image.height).toBe(120)
    expect([...files.keys()]).toEqual([
      `${image.key}-200.avif`,
      `${image.key}-200.webp`,
      `${image.key}-400.avif`,
      `${image.key}-400.webp`,
    ])
  })

  it('refuse un logo plus étroit que sa plus grande variante', async () => {
    await expect(
      storeImage(fakeMedia().media, upload('image/png 399x2000', 'Oraki'), 'logo'),
    ).rejects.toThrow("L'image doit faire au moins 400 px de large : elle fait 399 × 2000 px.")
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

  it('n’agrandit jamais une source étroite de produit : variantes arrêtées à sa largeur', async () => {
    const { media, files } = fakeMedia()

    const image = await storeImage(media, upload('image/jpeg 600x900', 'Fleur'), 'product')

    expect(image.width).toBe(600)
    expect([...files.keys()]).toEqual([
      `${image.key}-400.avif`,
      `${image.key}-400.webp`,
      `${image.key}-600.avif`,
      `${image.key}-600.webp`,
    ])
  })

  it('garde les largeurs plus petites qu’une source entre deux variantes', async () => {
    const { media, files } = fakeMedia()

    const image = await storeImage(media, upload('image/png 700x700', 'Fleur'), 'product')

    expect(image.width).toBe(700)
    expect([...files.keys()].filter((name) => name.endsWith('.webp'))).toEqual([
      `${image.key}-400.webp`,
      `${image.key}-640.webp`,
      `${image.key}-700.webp`,
    ])
  })

  it('ne garde pas de largeur pour une source assez large', async () => {
    const image = await storeImage(
      fakeMedia().media,
      upload('image/png 800x800', 'Fleur'),
      'product',
    )

    expect(image.width).toBeUndefined()
  })

  it.each([
    [
      upload('image/jpeg 1600x399', 'A'),
      'product',
      "Recadrée au format 1:1, l'image doit faire au moins 400 × 400 px : elle fait 1600 × 399 px.",
    ],
    [
      upload('image/png 511x511', '', true),
      'icon',
      "Recadrée au format 1:1, l'image doit faire au moins 512 × 512 px : elle fait 511 × 511 px.",
    ],
  ] as const)(
    'refuse une source trop petite pour son usage (%#)',
    async (input, usage, message) => {
      await expect(storeImage(fakeMedia().media, input, usage)).rejects.toThrow(message)
    },
  )

  it('encode une icône en PNG seulement, et l’image de partage en 1200 px', async () => {
    const { media, files } = fakeMedia()

    const icon = await storeImage(media, upload('image/png 512x512', '', true), 'icon')
    const share = await storeImage(media, upload('image/jpeg 1600x900', 'Oraki'), 'share')

    expect([...files.keys()]).toEqual([
      `${icon.key}-32.png`,
      `${icon.key}-180.png`,
      `${icon.key}-192.png`,
      `${icon.key}-512.png`,
      `${share.key}-1200.avif`,
      `${share.key}-1200.webp`,
    ])
  })
})
