import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestContext } from './context.ts'

import type { TestContext } from './context.ts'

let dev: TestContext
let prod: TestContext

beforeAll(async () => {
  dev = await createTestContext('scenario')
  prod = await createTestContext('scenario_prod', { APP_ENV: 'prod' })
})
afterAll(async () => {
  await dev.close()
  await prod.close()
})

const request = (
  context: TestContext,
  path: string,
  headers: Record<string, string>,
  init: RequestInit = {},
) => context.app.request(path, { ...init, headers: { Accept: 'application/json', ...headers } })

describe('X-Scenario', () => {
  it.each([
    '/api/tasks',
    '/api/articles',
    '/api/categories',
    '/api/products',
    '/api/product-facets',
  ])('error : 500 problem+json sur %s', async (path) => {
    const response = await request(dev, path, { 'X-Scenario': 'error' })

    expect(response.status).toBe(500)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
  })

  it.each([
    '/api/tasks',
    '/api/articles',
    '/api/categories',
    '/api/products',
    '/api/featured-products',
  ])('empty : collection vide sur %s', async (path) => {
    const response = await request(dev, path, { 'X-Scenario': 'empty' })

    expect(await response.json()).toEqual([])
  })

  it('empty : total et compteurs de facettes à 0', async () => {
    const response = await request(dev, '/api/product-facets?category=feuillages', {
      'X-Scenario': 'empty',
    })

    expect(await response.json()).toEqual({
      totalItems: 0,
      exposure: [
        { value: 'soleil', count: 0 },
        { value: 'mi-ombre', count: 0 },
        { value: 'ombre', count: 0 },
      ],
      size: [
        { value: 'S', count: 0 },
        { value: 'M', count: 0 },
        { value: 'L', count: 0 },
      ],
      category: [],
      attributes: [],
    })
  })

  it('error : 500 aussi sur le formulaire de contact', async () => {
    const response = await request(
      dev,
      '/api/contact_messages',
      { 'X-Scenario': 'error', 'Content-Type': 'application/json' },
      { method: 'POST', body: '{}' },
    )

    expect(response.status).toBe(500)
  })

  it('ignore une valeur inconnue', async () => {
    const response = await request(dev, '/api/tasks', { 'X-Scenario': 'inconnu' })

    expect(await response.json()).toHaveLength(3)
  })

  it('est sans effet en production', async () => {
    const error = await request(prod, '/api/tasks', { 'X-Scenario': 'error' })
    const empty = await request(prod, '/api/tasks', { 'X-Scenario': 'empty' })

    expect(error.status).toBe(200)
    expect(await empty.json()).toHaveLength(3)
  })
})

describe('CORS', () => {
  it('autorise le préflight d’une origine locale de front et X-Scenario', async () => {
    const response = await dev.app.request('/api/contact_messages', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3010',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, x-scenario',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3010')
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'content-type, accept, x-scenario',
    )
  })

  it("ajoute l'origine autorisée à une requête simple", async () => {
    const response = await dev.app.request('/api/tasks', {
      headers: { Origin: 'http://localhost:5173' },
    })

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it.each(['http://localhost:4002', 'http://127.0.0.1:4002', 'http://127.0.0.1:3010'])(
    'autorise %s (bloc des tests ou boucle locale, registre des ports)',
    async (origin) => {
      const response = await dev.app.request('/api/tasks', { headers: { Origin: origin } })

      expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    },
  )

  it('refuse un port hors du registre', async () => {
    const response = await dev.app.request('/api/tasks', {
      headers: { Origin: 'http://localhost:3130' },
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('refuse une origine inconnue', async () => {
    const response = await dev.app.request('/api/tasks', {
      method: 'OPTIONS',
      headers: { Origin: 'https://exemple.fr', 'Access-Control-Request-Method': 'GET' },
    })

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
