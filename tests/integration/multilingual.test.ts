import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestContext, getJson } from './context.ts'

import type { TestContext } from './context.ts'

/**
 * Contenu multilingue (SPEC-COMMUNE, section 29, ADR 0014), mêmes cas que MultilingualApiTest de
 * l'API Platform. Les fixtures n'activent que le français ; leurs traductions anglaises ne servent
 * qu'avec X-Scenario: bilingual, qui active aussi l'anglais.
 */
let context: TestContext

beforeAll(async () => {
  context = await createTestContext('multilingual')
})
afterAll(() => context.close())

const BILINGUAL = { 'X-Scenario': 'bilingual' }

const json = async (path: string, headers: Record<string, string> = {}) =>
  (await getJson(context, path, headers)).body

describe('site monolingue', () => {
  it('ignore la langue demandée', async () => {
    const { response, body } = await getJson(
      context,
      '/api/products/monstera-deliciosa?locale=en',
      {
        'Accept-Language': 'en',
      },
    )

    expect(response.headers.get('content-language')).toBe('fr')
    expect(body).toMatchObject({ name: 'Monstera deliciosa', alternates: [] })
    expect(await json('/api/site-identity')).toMatchObject({ locales: ['fr'] })
    const translated = await getJson(context, '/api/products/swiss-cheese-plant?locale=en')
    expect(translated.response.status).toBe(404)
  })

  it('ignore X-Scenario: bilingual en production', async () => {
    const production = await createTestContext('multilingual_prod', { APP_ENV: 'prod' })
    try {
      const { response } = await getJson(production, '/api/site-identity', {
        ...BILINGUAL,
        'Accept-Language': 'en',
      })
      expect(response.headers.get('content-language')).toBe('fr')
    } finally {
      await production.close()
    }
  })
})

describe('Content-Language et Vary', () => {
  it('portent sur toute réponse de l’API, erreurs comprises, documentation exclue', async () => {
    const tasks = await getJson(context, '/api/tasks')
    expect(tasks.response.headers.get('content-language')).toBe('fr')
    expect(tasks.response.headers.get('vary')).toContain('Accept-Language')

    const missing = await getJson(context, '/api/products/inconnu', {
      ...BILINGUAL,
      'Accept-Language': 'en',
    })
    expect(missing.response.status).toBe(404)
    expect(missing.response.headers.get('content-language')).toBe('en')

    const unknownRoute = await context.app.request('/api/nimporte', {
      headers: { Accept: 'application/json' },
    })
    expect(unknownRoute.headers.get('content-language')).toBe('fr')

    const docs = await context.app.request('/api/docs.jsonopenapi', {
      headers: { Accept: 'application/vnd.openapi+json' },
    })
    expect(docs.headers.get('content-language')).toBeNull()
  })
})

describe('choix de la langue', () => {
  it.each([
    ['', { 'Accept-Language': '' }, 'fr'],
    ['', { 'Accept-Language': 'en' }, 'en'],
    ['', { 'Accept-Language': 'en-GB' }, 'en'],
    ['', { 'Accept-Language': 'de, en;q=0.8, fr;q=0.5' }, 'en'],
    ['', { 'Accept-Language': 'fr;q=0.4, en' }, 'en'],
    ['', { 'Accept-Language': 'en;q=0' }, 'fr'],
    ['', { 'Accept-Language': 'de' }, 'fr'],
    ['?locale=fr', { 'Accept-Language': 'en' }, 'fr'],
    ['?locale=en', { 'Accept-Language': '' }, 'en'],
    ['?locale=EN-us', {}, 'en'],
    ['?locale=de', { 'Accept-Language': 'en' }, 'en'],
  ])('paramètre « %s », %j : %s', async (query, headers, expected) => {
    const { response } = await getJson(context, `/api/site-identity${query}`, {
      ...headers,
      ...BILINGUAL,
    })

    expect(response.headers.get('content-language')).toBe(expected)
  })
})

describe('traductions', () => {
  it('sert la traduction et se replie champ par champ', async () => {
    const product = await json('/api/products/swiss-cheese-plant?locale=en', BILINGUAL)

    expect(product).toMatchObject({
      name: 'Swiss cheese plant',
      metaTitle: 'Swiss cheese plant (Monstera deliciosa)',
      image: { alt: 'Monstera deliciosa' },
      categorySlug: 'monstera',
      categoryPath: [
        { slug: 'indoor-plants', name: 'Indoor plants' },
        { slug: 'foliage-plants', name: 'Foliage plants' },
        { slug: 'monstera', name: 'Monstera' },
      ],
      attributes: [
        { code: 'feuillage', label: 'Foliage', value: 'persistant', valueLabel: 'Evergreen' },
        { code: 'hauteur-adulte', label: 'Mature height', value: '300', unit: 'cm' },
      ],
      alternates: [
        { locale: 'fr', slug: 'monstera-deliciosa' },
        { locale: 'en', slug: 'swiss-cheese-plant' },
      ],
    })
    // Non traduite : la description française
    expect(JSON.stringify(product)).toContain('"description":"Grandes feuilles vert profond')
  })

  it('rattache un slug à sa langue', async () => {
    const french = await getJson(context, '/api/products/monstera-deliciosa?locale=en', BILINGUAL)
    expect(french.response.status).toBe(404)
    const english = await getJson(context, '/api/products/swiss-cheese-plant?locale=fr', BILINGUAL)
    expect(english.response.status).toBe(404)

    // Sans slug traduit, celui de la langue par défaut sert dans les deux langues
    expect(await json('/api/products/monstera-adansonii?locale=en', BILINGUAL)).toMatchObject({
      alternates: [
        { locale: 'fr', slug: 'monstera-adansonii' },
        { locale: 'en', slug: 'monstera-adansonii' },
      ],
    })
  })

  it('filtre le catalogue par le slug de la langue', async () => {
    const products = await json(
      '/api/products?locale=en&category=foliage-plants&itemsPerPage=48',
      BILINGUAL,
    )
    expect(products).toHaveLength(6)
    expect(products).toContainEqual(
      expect.objectContaining({ slug: 'swiss-cheese-plant', name: 'Swiss cheese plant' }),
    )

    const french = await getJson(context, '/api/products?locale=en&category=feuillages', BILINGUAL)
    expect(french.response.status).toBe(404)

    expect(
      await json('/api/product-facets?locale=en&category=indoor-plants', BILINGUAL),
    ).toMatchObject({
      category: [{ slug: 'foliage-plants', name: 'Foliage plants' }, {}],
      attributes: [
        {
          label: 'Foliage',
          values: [{ label: 'Evergreen' }, { label: 'Deciduous' }],
        },
      ],
    })
  })

  it('trie par le nom de la langue', async () => {
    const products = await json(
      '/api/products?locale=en&order[name]=desc&itemsPerPage=48',
      BILINGUAL,
    )
    expect(Array.isArray(products) && products[0]).toMatchObject({ name: 'Swiss cheese plant' })
  })

  it("traduit l'arbre des catégories", async () => {
    expect(await json('/api/categories?locale=en', BILINGUAL)).toMatchObject([
      {
        slug: 'indoor-plants',
        name: 'Indoor plants',
        alternates: [
          { locale: 'fr', slug: 'plantes-interieur' },
          { locale: 'en', slug: 'indoor-plants' },
        ],
        children: [{ parent: 'indoor-plants' }, {}],
      },
      {},
      {},
    ])
  })

  it('traduit les articles et leurs rubriques', async () => {
    const article = await json('/api/articles/enhanced-accessibility-mode?locale=en', BILINGUAL)
    expect(article).toMatchObject({
      title: 'The enhanced accessibility mode',
      alternates: [
        { locale: 'fr', slug: 'le-mode-accessibilite-renforcee' },
        { locale: 'en', slug: 'enhanced-accessibility-mode' },
      ],
    })
    // Texte non traduit : le HTML français
    expect(JSON.stringify(article)).toContain('agrandit le texte')

    const tips = await json('/api/articles?locale=en&section=tips', BILINGUAL)
    expect(tips).toHaveLength(2)
    expect(tips).toMatchObject([{ section: { slug: 'tips', name: 'Tips' } }, {}])
    expect(await json('/api/article-sections?locale=en', BILINGUAL)).toEqual([
      { slug: 'tips', name: 'Tips' },
      { slug: 'actualites', name: 'Actualités' },
    ])
  })

  it("traduit les contenus et l'identité", async () => {
    expect(await json('/api/legal_pages/mentions-legales?locale=en', BILINGUAL)).toMatchObject({
      title: 'Legal notice',
      alternates: [
        { locale: 'fr', slug: 'mentions-legales' },
        { locale: 'en', slug: 'mentions-legales' },
      ],
    })
    expect(await json('/api/page-metas?locale=en', BILINGUAL)).toContainEqual({
      page: 'blog',
      title: '',
      description:
        'Tips and news from the template: server rendering, accessibility, dependency-free components.',
    })
    expect(await json('/api/site-identity?locale=en', BILINGUAL)).toMatchObject({
      locales: ['fr', 'en'],
      name: 'Boilerplate',
      tagline: 'Website template with boilerplates-ui, equipped for QA and end-to-end testing.',
    })
  })
})

describe('contact', () => {
  it('cherche le produit dans la langue de la requête et garde le slug de la langue par défaut', async () => {
    const response = await context.app.request('/api/contact_messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'en',
        ...BILINGUAL,
      },
      body: JSON.stringify({
        name: 'Camille',
        email: 'camille@example.fr',
        message: 'Bonjour, je souhaite un devis.',
        product: 'swiss-cheese-plant',
      }),
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ product: 'monstera-deliciosa' })
    expect(context.mailer.sent.at(-1)?.subject).toContain('Monstera deliciosa')
  })
})
