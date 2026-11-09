import { describe, expect, it } from 'vitest'

import {
  keptTranslations,
  switchDefaultLocale,
  takenSlug,
  translated,
} from '#/shared/domain/translations.ts'
import { alternates, negotiateLocale } from '#/shared/http/contentLocale.ts'

describe('traductions (ADR 0014)', () => {
  it('se replie champ par champ sur la langue par défaut', () => {
    const translations = { en: { name: 'Swiss cheese plant' } }

    expect(translated(translations, 'name', 'Monstera', 'en')).toBe('Swiss cheese plant')
    expect(translated(translations, 'slug', 'monstera', 'en')).toBe('monstera')
    expect(translated(translations, 'name', 'Monstera', null)).toBe('Monstera')
  })

  it('ne garde pas les valeurs vides et nettoie la saisie', () => {
    expect(
      keptTranslations({ en: { name: '  Plant \r\n', slug: '  ', metaTitle: undefined }, de: {} }),
    ).toEqual({ en: { name: 'Plant' } })
  })

  it('échange les textes quand la langue par défaut change', () => {
    const { texts, translations } = switchDefaultLocale(
      { name: 'Monstera', description: 'Texte' },
      { en: { name: 'Swiss cheese plant' } },
      'fr',
      'en',
    )

    expect(texts).toEqual({ name: 'Swiss cheese plant', description: 'Texte' })
    expect(translations).toEqual({ fr: { name: 'Monstera', description: 'Texte' } })
  })

  it('vérifie le slug effectif dans chaque langue', async () => {
    const taken = new Set(['fr:monstera', 'en:swiss-cheese-plant'])
    const isTaken = (slug: string, locale: string | null) =>
      Promise.resolve(taken.has(`${locale ?? 'fr'}:${slug}`))

    expect(await takenSlug('nouveau', { en: { slug: '' } }, isTaken)).toBeNull()
    expect(await takenSlug('nouveau', { en: { slug: 'swiss-cheese-plant' } }, isTaken)).toBe(
      'swiss-cheese-plant',
    )
    expect(await takenSlug('monstera', {}, isTaken)).toBe('monstera')
  })
})

describe('langue demandée', () => {
  const enabled = ['fr', 'en'] as const

  it.each([
    [undefined, undefined, 'fr'],
    [undefined, 'en-GB,fr;q=0.9', 'en'],
    [undefined, 'de, en;q=0.8, fr;q=0.5', 'en'],
    [undefined, 'fr;q=0.4, en', 'en'],
    [undefined, 'en;q=0', 'fr'],
    [undefined, 'en_US', 'en'],
    ['EN-us', 'fr', 'en'],
    ['de', 'en', 'en'],
    [['en'], undefined, 'fr'],
  ])('paramètre %j, Accept-Language %j : %s', (parameter, header, expected) => {
    expect(negotiateLocale(enabled, parameter, header)).toBe(expected)
  })

  it('liste les versions dans les langues activées, aucune sur un site monolingue', () => {
    expect(alternates({ current: 'fr', locales: ['fr'] }, () => 'x')).toEqual([])
    expect(alternates({ current: 'fr', locales: ['fr', 'en'] }, (locale) => `x-${locale}`)).toEqual(
      [
        { locale: 'fr', slug: 'x-fr' },
        { locale: 'en', slug: 'x-en' },
      ],
    )
  })
})
