import { describe, expect, it } from 'vitest'

import { contrast, hexColor, mix } from '#/site/domain/hexColor.ts'

describe('hexColor (mêmes valeurs que HexColorTest de l’API Platform)', () => {
  it('garde la couleur en minuscules', () => {
    expect(hexColor(' #0B1F3A ')).toBe('#0b1f3a')
  })

  it.each(['0b1f3a', '#fff', '#0b1f3a80', '#gggggg'])('refuse %s : #rrggbb seulement', (value) => {
    expect(() => hexColor(value)).toThrow(
      `Couleur invalide : « ${value} ». Format attendu : #rrggbb.`,
    )
  })

  it('mélange comme les chartes des maquettes', () => {
    expect(mix('#0b1f3a', '#000000', 0.25)).toBe('#08172c')
    expect(mix('#ffffff', '#0b1f3a', 0.08)).toBe('#ebedef')
  })

  it('arrondit au pair, comme Python', () => {
    // 6 × 0,75 = 4,5 : Python arrondit à 4, Math.round à 5
    expect(mix('#060606', '#000000', 0.25)).toBe('#040404')
  })

  it.each([
    ['#000000', '#ffffff', 21],
    ['#1d4ed8', '#1d4ed8', 1],
    ['#1d4ed8', '#ffffff', 6.7],
    ['#ffffff', '#767676', 4.54],
  ])('calcule le contraste WCAG de %s et %s', (first, second, expected) => {
    expect(Math.abs(contrast(first, second) - expected)).toBeLessThanOrEqual(0.01)
    expect(Math.abs(contrast(second, first) - expected)).toBeLessThanOrEqual(0.01)
  })
})
