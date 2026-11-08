import { describe, expect, it } from 'vitest'

import { DARK_BACKGROUND, darkPalette, lightPalette } from '#/site/domain/brandPalette.ts'
import { contrast, mix } from '#/site/domain/hexColor.ts'

import type { ColorShades } from '#/site/domain/brandPalette.ts'

/** Couleur, foncée, texte dessus, surfaces légère, moyenne et forte. */
const values = (shades: ColorShades) => [
  shades.color,
  shades.dark,
  shades.on,
  shades.surfaceSubtle,
  shades.surface,
  shades.surfaceStrong,
]

/**
 * Valeurs attendues de BrandPaletteTest de l’API Platform : clair, maquettes-sites/chartes.py
 * (charte « rrc ») ; sombre, règles de la section 22 de SPEC-COMMUNE.
 */
describe('palette de marque', () => {
  it('décline les deux couleurs sur le fond clair', () => {
    const palette = lightPalette('#0b1f3a', '#f2b705')

    expect(values(palette.primary)).toEqual([
      '#0b1f3a',
      '#08172c',
      '#ffffff',
      '#ebedef',
      '#d3d7dc',
      '#b1b7c0',
    ])
    expect(values(palette.secondary)).toEqual([
      '#f2b705',
      '#b68904',
      '#111827',
      '#fef9eb',
      '#fdf2d2',
      '#fbe8af',
    ])
  })

  it('éclaircit chaque couleur par pas de 5 % jusqu’à 4,5:1 sur le fond sombre', () => {
    const palette = darkPalette('#1d4ed8', '#7c3aed')

    // 25 % de blanc pour la principale, 20 % pour la secondaire, -dark à 25 % de blanc en plus, texte de la couleur du fond
    expect(values(palette.primary)).toEqual([
      '#567ae2',
      '#809be9',
      '#0f141d',
      '#151c2d',
      '#182035',
      '#1c2742',
    ])
    expect(values(palette.secondary)).toEqual([
      '#9661f1',
      '#b088f4',
      '#0f141d',
      '#1a1a2e',
      '#1f1d36',
      '#292345',
    ])
    expect(contrast(palette.primary.color, DARK_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(mix('#1d4ed8', '#ffffff', 0.2), DARK_BACKGROUND)).toBeLessThan(4.5)
  })

  it.each(['#000000', '#1d4ed8', '#7c3aed', '#9f66ae', '#ff5a1f'])(
    'garde un texte lisible sur %s en sombre',
    (color) => {
      const shades = darkPalette(color, color).primary
      expect(contrast(shades.on, shades.color)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('garde une couleur déjà lisible sur le fond sombre', () => {
    const palette = darkPalette('#f2b705', '#ffffff')

    expect(palette.primary.color).toBe('#f2b705')
    expect([palette.secondary.color, palette.secondary.dark]).toEqual(['#ffffff', '#ffffff'])
  })

  it('éclaircit le noir en gris moyen', () => {
    expect(darkPalette('#000000', '#000000').primary.color).toBe('#808080')
  })
})
