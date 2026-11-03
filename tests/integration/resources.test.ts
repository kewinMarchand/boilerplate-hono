import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestContext, getJson } from './context.ts'

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
      },
    ])
  })
})

describe('GET /api/slides', () => {
  it("liste les diapositives dans l'ordre du carrousel", async () => {
    const { response, body } = await getJson(context, '/api/slides')

    expect(response.status).toBe(200)
    expect(body).toEqual([
      {
        id: 1,
        slug: 'heliconia',
        title: 'Heliconia',
        text: 'Des bractées rouges et jaunes en pinces de homard, qui tiennent des semaines au jardin.',
        image: 1,
      },
      expect.objectContaining({ slug: 'anthurium', image: 2 }),
      expect.objectContaining({ slug: 'calliandra', image: 3 }),
      expect.objectContaining({ slug: 'strelitzia', image: 4 }),
      expect.objectContaining({ slug: 'nenuphar', image: 5 }),
    ])
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
          html: '<p>Les messages sont conservés trois ans à compter du dernier échange, puis supprimés.</p>',
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
