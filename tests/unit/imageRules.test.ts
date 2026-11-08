import { describe, expect, it } from 'vitest'

import {
  fallbackFormatOf,
  formatsOf,
  heightFor,
  minimumWidth,
  widthsUpTo,
} from '#/media/domain/imageRules.ts'
import { imageView, toAudioView } from '#/media/http/imageContract.ts'

/** Mêmes cas qu'ImageUsageTest et ImageViewsTest de l'API Platform. */
describe('usages des images', () => {
  it.each([
    [400, [400]],
    [600, [400, 600]],
    [640, [400, 640]],
    [700, [400, 640, 700]],
    [800, [400, 640, 800]],
    [2000, [400, 640, 800]],
  ])('arrête les largeurs d’un produit à celle de la source (%i px)', (source, expected) => {
    expect(widthsUpTo('product', source)).toEqual(expected)
  })

  it('n’accepte une source plus étroite que sa plus grande variante que pour un produit', () => {
    expect(
      (['product', 'article', 'logo', 'share', 'icon'] as const).map((usage) =>
        minimumWidth(usage),
      ),
    ).toEqual([400, 960, 400, 1200, 512])
  })

  it('recadre l’image de partage en 1200 × 630', () => {
    expect(heightFor('share', 1200)).toBe(630)
  })

  it('écrit les icônes en PNG, les photos en AVIF puis WebP', () => {
    expect([formatsOf('icon'), fallbackFormatOf('icon')]).toEqual([['png'], 'png'])
    expect([formatsOf('product'), fallbackFormatOf('product')]).toEqual([['avif', 'webp'], 'webp'])
  })
})

describe('contrat des médias', () => {
  const media = `http://localhost:8090/media/${'a'.repeat(32)}`

  it('arrête le srcset d’une source étroite à sa largeur', () => {
    const view = imageView(
      'http://localhost:8090',
      { key: 'a'.repeat(32), alt: 'Fleur', width: 600 },
      'product',
    )

    expect([view.width, view.height]).toEqual([600, 600])
    expect(view.sources[1]?.srcset).toBe(`${media}-400.webp 400w, ${media}-600.webp 600w`)
  })

  it('sert un fichier audio sous /media/', () => {
    expect(
      toAudioView('http://localhost:8090/', {
        key: 'b'.repeat(32),
        format: 'm4a',
        durationSeconds: 1560,
      }),
    ).toEqual({
      src: `http://localhost:8090/media/${'b'.repeat(32)}.m4a`,
      type: 'audio/mp4',
      durationSeconds: 1560,
    })
  })
})
