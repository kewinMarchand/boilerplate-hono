import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { en } from '#/shared/http/adminMessages/en.ts'
import { fr } from '#/shared/http/adminMessages/fr.ts'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, getJson, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

/**
 * Admin en français et en anglais, onglets de langue du contenu (SPEC-COMMUNE, section 29,
 * ADR 0014), comme AdminLanguageTest de l'API Platform.
 */
let context: TestContext
let cookie = ''

const ORIGIN = 'http://localhost'

const headers = (extra: Record<string, string> = {}) => ({
  Origin: ORIGIN,
  ...(cookie === '' ? {} : { Cookie: cookie }),
  ...extra,
})

const page = (path: string) => context.app.request(`${ORIGIN}${path}`, { headers: headers() })

const post = (path: string, fields: Record<string, string>) =>
  context.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: new URLSearchParams(fields).toString(),
  })

/** Cookie de session et cookie de langue, gardés comme le ferait le navigateur. */
const keepCookies = (response: Response) => {
  const jar = new Map(
    cookie
      .split('; ')
      .filter((pair) => pair !== '')
      .map((pair) => [pair.split('=')[0] ?? '', pair] as const),
  )
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0] ?? ''
    jar.set(pair.split('=')[0] ?? '', pair)
  }
  cookie = [...jar.values()].join('; ')
}

/** Texte de la page, entités HTML de base décodées. */
const text = async (response: Response) =>
  (await response.text())
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

beforeAll(async () => {
  context = await createTestContext('admin_langues')
  await saveAdmin(
    createRepositories(context.db, mediaDependencies(TEST_MEDIA_DIR)),
    'admin@exemple.fr',
    'mot-de-passe-solide',
  )
  keepCookies(
    await post('/admin/login', { email: 'admin@exemple.fr', password: 'mot-de-passe-solide' }),
  )
})
afterAll(() => context.close())

/** Fragments des libellés français absents de l'anglais : aucun ne doit rester dans une page en anglais. */
const ENGLISH = new Map<string, string>(Object.entries(en))
const FRENCH_ONLY = Object.entries(fr).flatMap(([key, french]) => {
  const english = ENGLISH.get(key) ?? ''
  // Les noms des pages fixes sont aussi des titres de contenu (« Mentions légales ») : vérifiés à part
  return french === english || key.startsWith('meta_page.')
    ? []
    : french
        .split(/%[a-zA-Z]+%/)
        .map((fragment) => fragment.trim())
        .filter(
          // Les codes (« mi-ombre ») sont aussi des valeurs de champ, communes aux deux langues
          (fragment) =>
            fragment.length >= 6 && !/^[a-z-]+$/.test(fragment) && !english.includes(fragment),
        )
})

const ADMIN_PAGES = [
  '/admin',
  '/admin/categories',
  '/admin/categories/nouvelle',
  '/admin/categories/feuillages/modifier',
  '/admin/categories/fougeres/supprimer',
  '/admin/produits',
  '/admin/produits/nouveau',
  '/admin/produits/1/modifier',
  '/admin/produits/1/supprimer',
  '/admin/attributs',
  '/admin/attributs/nouveau',
  '/admin/attributs/feuillage/modifier',
  '/admin/attributs/feuillage/supprimer',
  '/admin/articles',
  '/admin/articles/nouveau',
  '/admin/articles/2/modifier',
  '/admin/articles/2/supprimer',
  '/admin/rubriques',
  '/admin/rubriques/nouveau',
  '/admin/rubriques/1/modifier',
  '/admin/rubriques/1/supprimer',
  '/admin/formats',
  '/admin/formats/3/modifier',
  '/admin/pages-legales',
  '/admin/pages-legales/mentions-legales/modifier',
  '/admin/identite-du-site',
  '/admin/referencement',
  '/admin/referencement/blog/modifier',
  '/admin/messages',
  '/admin/messages/1',
  '/admin/produits/999/modifier',
]

describe("langue de l'interface", () => {
  it('sert la page de connexion en français par défaut, en anglais au choix', async () => {
    const french = await text(
      await context.app.request(`${ORIGIN}/admin/login`, { headers: { Origin: ORIGIN } }),
    )
    expect(french).toContain('<html lang="fr">')
    expect(french).toContain('Se connecter')

    const english = await context.app.request(`${ORIGIN}/admin/login?_locale=en`, {
      headers: { Origin: ORIGIN },
    })
    const body = await text(english)
    expect(body).toContain('<html lang="en">')
    expect(body).toContain('Sign in')
    expect(english.headers.get('set-cookie')).toContain('admin_locale=en')
  })

  it('traduit les messages de la connexion', async () => {
    const refused = await context.app.request(`${ORIGIN}/admin/login`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Cookie: 'admin_locale=en',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ email: 'inconnu@exemple.fr', password: 'faux' }).toString(),
    })
    expect(await text(refused)).toContain('Invalid credentials.')
  })

  it("sert toute l'interface en anglais, sans libellé français restant", async () => {
    // Un message reçu, pour sa page de détail
    await context.app.request('/api/contact_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name: 'Camille',
        email: 'camille@exemple.fr',
        message: 'Bonjour, un devis.',
      }),
    })
    keepCookies(await page('/admin?_locale=en'))

    for (const path of ADMIN_PAGES) {
      const body = await text(await page(path))
      expect(body, path).toContain('<html lang="en">')
      for (const fragment of FRENCH_ONLY) {
        expect(body, `${path} : « ${fragment} »`).not.toContain(fragment)
      }
    }
    expect(await text(await page('/admin/referencement'))).toContain('Legal notice')
    // Messages de validation et règles du domaine
    const refused = await text(
      await post('/admin/categories/nouvelle', {
        name: '',
        slug: 'A B',
        position: '0',
        parent: '',
      }),
    )
    expect(refused).toContain('This value should not be blank.')
    expect(refused).toContain('Lowercase letters, digits and hyphens only.')
    const taken = await text(
      await post('/admin/categories/nouvelle', {
        name: 'Doublon',
        slug: 'feuillages',
        position: '0',
        parent: '',
      }),
    )
    expect(taken).toContain('The slug “feuillages” is already used by another category.')

    keepCookies(await page('/admin?_locale=fr'))
    const french = await text(await page('/admin/categories'))
    expect(french).toContain('<html lang="fr">')
    expect(french).toContain('Nouvelle catégorie')
  })
})

describe('onglets de langue du contenu', () => {
  const identity = (defaultLocale: string, others: readonly string[]) => ({
    name: 'Boilerplate',
    tagline: 'Modèle de site avec boilerplates-ui, outillé pour la QA et les tests end-to-end.',
    useLibraryColors: 'on',
    primaryColor: '#000000',
    secondaryColor: '#000000',
    defaultColorScheme: 'auto',
    salesEnabled: 'on',
    contactRecipient: 'contact@example.com',
    defaultLocale,
    ...Object.fromEntries(others.map((locale) => [`otherLocales[${locale}]`, 'on'])),
  })

  const product = (fields: Record<string, string> = {}) => ({
    name: 'Monstera adansonii',
    slug: 'monstera-adansonii',
    categorySlug: 'monstera',
    price: '19,90',
    exposure: 'mi-ombre',
    size: 'S',
    inStock: 'on',
    imageAlt: 'Monstera adansonii',
    ...fields,
  })

  it("n'a pas d'onglet sur un site d'une seule langue", async () => {
    keepCookies(await page('/admin?_locale=fr'))
    const body = await text(await page('/admin/produits/2/modifier'))
    expect(body).not.toContain('class="onglets"')
    expect(body).not.toContain('translations[')
  })

  it('ajoute un onglet par langue activée, marque celui en erreur et enregistre la traduction', async () => {
    expect((await post('/admin/identite-du-site', identity('fr', ['en']))).status).toBe(303)
    expect(await getJson(context, '/api/site-identity')).toMatchObject({
      body: { locales: ['fr', 'en'] },
    })

    const form = await text(await page('/admin/produits/2/modifier'))
    expect(form).toContain('class="onglets"')
    expect(form).toContain('>English<')
    expect(form).toContain('name="translations[en][name]"')

    const invalid = await post(
      '/admin/produits/2/modifier',
      product({ 'translations[en][slug]': 'Pas Un Slug' }),
    )
    expect(invalid.status).toBe(422)
    expect(await text(invalid)).toContain('English (contient des erreurs)')

    const saved = await post(
      '/admin/produits/2/modifier',
      product({
        'translations[en][name]': 'Five holes plant',
        'translations[en][slug]': 'five-holes-plant',
      }),
    )
    expect(saved.status).toBe(303)
    expect(await getJson(context, '/api/products/five-holes-plant?locale=en')).toMatchObject({
      body: { name: 'Five holes plant', categorySlug: 'monstera' },
    })
    // Un slug traduit déjà pris dans la langue est refusé
    const taken = await post(
      '/admin/produits/2/modifier',
      product({ 'translations[en][slug]': 'swiss-cheese-plant' }),
    )
    expect(await text(taken)).toContain(
      'Le slug « swiss-cheese-plant » est déjà pris par un autre produit.',
    )
  })

  it('échange les textes de toutes les fiches quand la langue par défaut change', async () => {
    // Le navigateur renvoie l'accroche anglaise, préremplie dans l'onglet English
    const tagline = 'Website template with boilerplates-ui, equipped for QA and end-to-end testing.'
    expect(
      (
        await post('/admin/identite-du-site', {
          ...identity('en', ['fr']),
          'translations[en][tagline]': tagline,
        })
      ).status,
    ).toBe(303)

    expect(await getJson(context, '/api/site-identity')).toMatchObject({
      body: {
        locales: ['en', 'fr'],
        tagline,
      },
    })
    expect(await getJson(context, '/api/products/swiss-cheese-plant')).toMatchObject({
      body: {
        name: 'Swiss cheese plant',
        categoryPath: [{ slug: 'indoor-plants' }, { slug: 'foliage-plants' }, { slug: 'monstera' }],
      },
    })
    expect(await getJson(context, '/api/products/monstera-deliciosa?locale=fr')).toMatchObject({
      body: { name: 'Monstera deliciosa' },
    })
    const foliage = await getJson(context, '/api/products?category=foliage-plants&itemsPerPage=48')
    expect(foliage.body).toHaveLength(6)
    expect(await getJson(context, '/api/legal_pages/mentions-legales')).toMatchObject({
      body: { title: 'Legal notice' },
    })

    expect((await post('/admin/identite-du-site', identity('fr', []))).status).toBe(303)
    expect(await getJson(context, '/api/products/monstera-deliciosa')).toMatchObject({
      body: { name: 'Monstera deliciosa', alternates: [] },
    })
  })
})
