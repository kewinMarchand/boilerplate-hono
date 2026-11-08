import { describe, expect, it } from 'vitest'

import { brandColors, brandColorsFromInput } from '#/site/domain/brandColors.ts'

/** Mêmes cas et mêmes messages que BrandColorsTest de l’API Platform. */
describe('couleurs de marque', () => {
  it('garde les jetons de la bibliothèque sans aucune couleur', () => {
    expect(brandColorsFromInput(' ', '')).toBeNull()
  })

  it.each([
    ['#c2410c', ''],
    ['', '#ffffff'],
  ])('refuse une seule couleur (%s, %s)', (primary, secondary) => {
    expect(() => brandColorsFromInput(primary, secondary)).toThrow(
      'Saisir les deux couleurs, ou aucune.',
    )
  })

  it('refuse une couleur mal écrite', () => {
    expect(() => brandColorsFromInput('#c2410c', 'blanc')).toThrow(
      'Couleur invalide : « blanc ». Format attendu : #rrggbb.',
    )
  })

  it.each([
    ['#ffff00', '1,07'],
    ['#7a7a7a', '4,29'],
    ['#777777', '4,47'],
  ])('refuse une couleur principale illisible sur le fond clair (%s)', (primary, ratio) => {
    expect(() => brandColors(primary, '#ffffff')).toThrow(
      `La couleur principale doit contraster à 4,5:1 au moins avec le fond clair (actuellement ${ratio}:1).`,
    )
  })

  it('refuse une couleur secondaire qui ne porte aucun texte lisible', () => {
    expect(() => brandColors('#c2410c', '#9f66ae')).toThrow(
      'La couleur secondaire ne permet pas de texte lisible dessus (au mieux 4,21:1, 4,5:1 au minimum).',
    )
  })

  it('accepte des couleurs au seuil', () => {
    expect(brandColorsFromInput('#767676', '#F2B705')).toEqual({
      primary: '#767676',
      secondary: '#f2b705',
    })
  })
})
