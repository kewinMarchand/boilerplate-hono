import { describe, expect, it } from 'vitest'

import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
import { SiteRuleViolation } from '#/site/domain/SiteIdentity.ts'
import { getSiteIdentity, updateSiteIdentity } from '#/site/application/siteIdentity.ts'

import { fakeMedia, photo } from './fakeMedia.ts'

import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'

const identities = (identity: SiteIdentity.Entity | null = null) => {
  let saved = identity
  const repository: SiteIdentity.Repository = {
    find: () => Promise.resolve(saved),
    save: (value) => {
      saved = value
      return Promise.resolve()
    },
  }
  return { repository, saved: () => saved }
}

const withLogo: SiteIdentity.Entity = {
  name: 'Oraki',
  tagline: '',
  logo: { key: 'b'.repeat(32), alt: 'Oraki', height: 120 },
  colors: null,
  defaultColorScheme: 'auto',
  shareImage: null,
  icon: null,
  salesEnabled: true,
  contactRecipient: 'contact@example.com',
  locales: ['fr'],
  translations: {},
}

const input = (overrides: Partial<SiteIdentity.Input> = {}): SiteIdentity.Input => ({
  name: 'Oraki',
  tagline: 'Plantes rares.',
  useLibraryColors: false,
  primaryColor: '#C2410C',
  secondaryColor: '#ffffff',
  defaultColorScheme: 'dark',
  imageContent: null,
  imageAlt: '',
  removeLogo: false,
  shareImageContent: null,
  shareImageAlt: '',
  removeShareImage: false,
  iconContent: null,
  removeIcon: false,
  salesEnabled: false,
  contactRecipient: 'ventes@oraki.fr',
  ...overrides,
})

/** Mêmes cas que SiteIdentityWritesTest de l’API Platform. */
describe('identité du site', () => {
  it('sert les valeurs du modèle tant que rien n’est enregistré', async () => {
    const { repository, saved } = identities()

    expect((await getSiteIdentity({ siteIdentities: repository })).name).toBe('Boilerplate')
    expect(saved()).toBeNull()
  })

  it('enregistre l’identité et un nouveau logo nommé d’après le site', async () => {
    const { repository, saved } = identities()

    await updateSiteIdentity(
      { siteIdentities: repository, media: fakeMedia().media },
      input({ imageContent: photo('image/png 800x240') }),
    )

    expect(saved()).toMatchObject({
      name: 'Oraki',
      tagline: 'Plantes rares.',
      colors: { primary: '#c2410c', secondary: '#ffffff' },
      defaultColorScheme: 'dark',
      logo: { alt: 'Oraki', height: 120 },
      salesEnabled: false,
      contactRecipient: 'ventes@oraki.fr',
    })
  })

  it('revient aux jetons de la bibliothèque sans couleurs', async () => {
    const { repository, saved } = identities()

    await updateSiteIdentity(
      { siteIdentities: repository, media: fakeMedia().media },
      input({ primaryColor: '', secondaryColor: '' }),
    )

    expect(saved()?.colors).toBeNull()
  })

  it('garde le logo actuel, sa hauteur comprise, avec son nouveau texte', async () => {
    const { repository, saved } = identities(withLogo)

    await updateSiteIdentity(
      { siteIdentities: repository, media: fakeMedia().media },
      input({ imageAlt: 'Oraki, plantes rares' }),
    )

    expect(saved()?.logo).toEqual({ key: 'b'.repeat(32), alt: 'Oraki, plantes rares', height: 120 })
  })

  it('retire le logo sans encoder le fichier envoyé en même temps', async () => {
    const { repository, saved } = identities(withLogo)
    const { media, files } = fakeMedia()

    await updateSiteIdentity(
      { siteIdentities: repository, media },
      input({ removeLogo: true, imageContent: photo('image/png 800x240') }),
    )

    expect(saved()?.logo).toBeNull()
    expect(files.size).toBe(0)
  })

  it('ne laisse aucun logo encodé après des couleurs refusées', async () => {
    const { repository, saved } = identities()
    const { media, files } = fakeMedia()

    await expect(
      updateSiteIdentity(
        { siteIdentities: repository, media },
        input({ secondaryColor: '', imageContent: photo('image/png 800x240') }),
      ),
    ).rejects.toThrow(new SiteRuleViolation('Saisir les deux couleurs, ou aucune.'))
    expect(files.size).toBe(0)
    expect(saved()).toBeNull()
  })

  it('ignore les couleurs saisies quand la case « couleurs de la bibliothèque » est cochée', async () => {
    const { repository, saved } = identities()

    await updateSiteIdentity(
      { siteIdentities: repository, media: fakeMedia().media },
      input({ useLibraryColors: true, primaryColor: '#ffff00' }),
    )

    expect(saved()?.colors).toBeNull()
  })

  it('enregistre une icône en PNG et une image de partage nommée d’après le site', async () => {
    const { repository, saved } = identities()
    const { media, files } = fakeMedia()

    await updateSiteIdentity(
      { siteIdentities: repository, media },
      input({
        iconContent: photo('image/png 512x512'),
        shareImageContent: photo('image/jpeg 1200x630'),
      }),
    )

    expect([saved()?.icon?.alt, saved()?.shareImage?.alt]).toEqual(['', 'Oraki'])
    expect(files.has(`${saved()?.icon?.key}-512.png`)).toBe(true)
    expect(files.has(`${saved()?.shareImage?.key}-1200.webp`)).toBe(true)
  })

  it('retire l’icône et l’image de partage sans encoder les fichiers envoyés en même temps', async () => {
    const { repository, saved } = identities({
      ...withLogo,
      shareImage: { key: 'c'.repeat(32), alt: 'Oraki' },
      icon: { key: 'd'.repeat(32), alt: '' },
    })
    const { media, files } = fakeMedia()

    await updateSiteIdentity(
      { siteIdentities: repository, media },
      input({
        removeIcon: true,
        iconContent: photo('image/png 512x512'),
        removeShareImage: true,
        shareImageContent: photo('image/jpeg 1200x630'),
      }),
    )

    expect([saved()?.icon, saved()?.shareImage]).toEqual([null, null])
    expect(files.size).toBe(0)
  })

  it('refuse une icône de moins de 512 px', async () => {
    await expect(
      updateSiteIdentity(
        { siteIdentities: identities().repository, media: fakeMedia().media },
        input({ iconContent: photo('image/png 256x256') }),
      ),
    ).rejects.toThrow(
      new MediaRuleViolation(
        "Recadrée au format 1:1, l'image doit faire au moins 512 × 512 px : elle fait 256 × 256 px.",
      ),
    )
  })
})
