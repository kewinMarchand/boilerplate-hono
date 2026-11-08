import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createTestContext, demoView, getJson } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('resources')
})
afterAll(() => context.close())

describe('GET /api/tasks', () => {
  it('liste les tâches en JSON simple', async () => {
    const { response, body } = await getJson(context, '/api/tasks')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(body).toEqual([
      { id: 1, title: 'Brancher la vraie API', done: false },
      { id: 2, title: 'Générer les types OpenAPI', done: false },
      { id: 3, title: 'Lancer make qa', done: true },
    ])
  })

  it('est en lecture seule', async () => {
    const response = await context.app.request('/api/tasks', { method: 'POST' })

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
  })

  it("répond 404 sur l'item, non exposé", async () => {
    const { response, body } = await getJson(context, '/api/tasks/1')

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ detail: 'This route does not aim to be called.' })
  })
})

describe('GET /api/articles', () => {
  it('liste les articles du plus récent au plus ancien', async () => {
    const { body } = await getJson(context, '/api/articles')

    expect(body).toEqual([
      expect.objectContaining({
        id: 3,
        slug: 'le-mode-accessibilite-renforcee',
        publishedAt: '2026-10-01',
      }),
      expect.objectContaining({ id: 2, publishedAt: '2026-09-22' }),
      {
        id: 1,
        slug: 'pourquoi-rendre-le-contenu-cote-serveur',
        title: 'Pourquoi rendre le contenu côté serveur',
        excerpt:
          'Le contenu éditorial arrive dans le HTML initial : meilleur référencement et LCP.',
        publishedAt: '2026-09-15',
        image: demoView('blog-1', 'article', ''),
      },
    ])
  })
})

describe('GET /api/articles/{slug}', () => {
  it('renvoie la fiche, texte converti en HTML', async () => {
    const { response, body } = await getJson(
      context,
      '/api/articles/un-carrousel-accessible-sans-dependance',
    )

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      id: 2,
      slug: 'un-carrousel-accessible-sans-dependance',
      title: 'Un carrousel accessible sans dépendance',
      publishedAt: '2026-09-22',
      image: demoView('blog-2', 'article', ''),
    })
    const { html } = z.object({ html: z.string() }).parse(body)
    expect(html).toMatch(/^<p>Un carrousel est souvent/)
    expect(html).toContain('<h2>Partir du défilement natif</h2>')
    expect(html).toContain('<code>overflow-x: auto</code>')
  })

  it('répond 404 sur un article inconnu', async () => {
    const { response, body } = await getJson(context, '/api/articles/inconnu')

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ detail: 'Not Found' })
  })
})

describe('GET /api/products/{slug}', () => {
  it('renvoie la fiche avec le chemin de sa catégorie', async () => {
    const { response, body } = await getJson(context, '/api/products/monstera-deliciosa')

    expect(response.status).toBe(200)
    expect(body).toStrictEqual({
      id: 1,
      slug: 'monstera-deliciosa',
      name: 'Monstera deliciosa',
      categorySlug: 'monstera',
      price: 3490,
      exposure: 'mi-ombre',
      size: 'M',
      inStock: true,
      image: demoView('product-1', 'product', 'Monstera deliciosa'),
      categoryPath: [
        { slug: 'plantes-interieur', name: 'Plantes d’intérieur' },
        { slug: 'feuillages', name: 'Feuillages' },
        { slug: 'monstera', name: 'Monstera' },
      ],
      description:
        'Grandes feuilles vert profond, découpées et perforées avec l’âge : le monstera deliciosa habille une pièce à lui seul.\n\nLumière vive sans soleil direct, arrosage quand le terreau a séché sur deux centimètres. Un tuteur en mousse l’aide à grimper.',
    })
  })

  it('répond 404 sur un produit inconnu', async () => {
    const { response } = await getJson(context, '/api/products/inconnu')

    expect(response.status).toBe(404)
  })
})

describe('GET /api/featured-products', () => {
  it('liste les produits à la une par nom, sans les champs featured ni description', async () => {
    const { response, body } = await getJson(context, '/api/featured-products')
    const products = z.array(z.record(z.string(), z.unknown())).parse(body)

    expect(response.status).toBe(200)
    expect(products.map((product) => product['slug'])).toStrictEqual([
      'anthurium-andreanum-rouge',
      'calliandra-haematocephala',
      'heliconia-rostrata',
      'nenuphar-bleu-du-nil',
      'strelitzia-reginae',
    ])
    expect(Object.keys(products[0] ?? {})).not.toContain('featured')
    expect(Object.keys(products[0] ?? {})).not.toContain('description')
  })
})

describe('GET /api/legal_pages/{slug}', () => {
  it('renvoie la page découpée en sections HTML', async () => {
    const { response, body } = await getJson(context, '/api/legal_pages/donnees-personnelles')

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      slug: 'donnees-personnelles',
      title: 'Données personnelles',
      introduction: '',
    })
    expect(body).toHaveProperty(
      'sections',
      expect.arrayContaining([
        {
          title: 'Durée de conservation',
          html: '<p>Les messages sont conservés trois ans au plus à compter du dernier échange, puis supprimés.</p>',
        },
      ]),
    )
  })

  it('répond 404 sur une page inconnue', async () => {
    const { response, body } = await getJson(context, '/api/legal_pages/cgv')

    expect(response.status).toBe(404)
    expect(body).toMatchObject({ detail: 'Not Found' })
  })
})

describe('GET /api/categories', () => {
  it("renvoie l'arbre complet, parent null à la racine", async () => {
    const { body } = await getJson(context, '/api/categories')

    expect(body).toEqual([
      expect.objectContaining({
        slug: 'plantes-interieur',
        name: 'Plantes d’intérieur',
        parent: null,
      }),
      expect.objectContaining({ slug: 'plantes-exterieur', parent: null }),
      {
        slug: 'plantes-aquatiques',
        name: 'Plantes aquatiques',
        parent: null,
        children: [
          { slug: 'nenuphars', name: 'Nénuphars', parent: 'plantes-aquatiques', children: [] },
        ],
      },
    ])
  })
})

describe('négociation', () => {
  it('répond 406 à un Accept sans format JSON', async () => {
    const response = await context.app.request('/api/tasks', { headers: { Accept: 'text/html' } })

    expect(response.status).toBe(406)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
  })

  it('sert le schéma OpenAPI', async () => {
    const response = await context.app.request('/api/docs.jsonopenapi')
    const document: unknown = await response.json()

    expect(response.headers.get('content-type')).toBe('application/vnd.openapi+json')
    expect(document).toMatchObject({ openapi: '3.1.0', paths: { '/api/products': { get: {} } } })
  })
})

describe('validateur MongoDB', () => {
  it('refuse un document qui ne respecte pas le schéma zod', async () => {
    await expect(
      context.db
        .collection<{ _id: number; [field: string]: unknown }>('tasks')
        .insertOne({ _id: 99, title: '', done: 'non' }),
    ).rejects.toThrow('Document failed validation')
  })
})

describe('GET /media/{fichier}', () => {
  it('sert une variante avec un cache d’un an, et 404 pour un fichier absent ou un nom inattendu', async () => {
    const { body } = await getJson(context, '/api/articles')
    const src = JSON.stringify(body).match(/"src":"http:\/\/localhost:8091(\/media\/[^"]+)"/)?.[1]
    expect(src).toBeDefined()

    const media = await context.app.request(src ?? '')
    expect(media.status).toBe(200)
    expect(media.headers.get('content-type')).toBe('image/webp')
    expect(media.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(media.headers.get('x-content-type-options')).toBe('nosniff')

    expect((await context.app.request(`/media/${'0'.repeat(32)}-640.webp`)).status).toBe(404)
    expect((await context.app.request('/media/..%2Fpackage.json')).status).toBe(404)
  })
})
