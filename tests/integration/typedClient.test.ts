import { testClient } from 'hono/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createTestContext } from './context.ts'

import type { TestContext } from './context.ts'
import type { Task } from '#/task/domain/Task.ts'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('client')
})
afterAll(() => context.close())

describe('client typé hc (AppType)', () => {
  it('type les réponses depuis les schémas zod', async () => {
    const client = testClient(context.app)

    const tasks: Task.Entity[] = await (await client.api.tasks.$get()).json()
    const response = await client.api['product-facets'].$get({ query: { category: 'monstera' } })
    if (response.status !== 200) {
      throw new Error(`Statut inattendu : ${response.status}`)
    }
    const facets = await response.json()

    expect(tasks).toHaveLength(3)
    expect(facets.totalItems).toBe(3)
    expect(facets.exposure.map((facet) => facet.value)).toEqual(['soleil', 'mi-ombre', 'ombre'])
  })
})
