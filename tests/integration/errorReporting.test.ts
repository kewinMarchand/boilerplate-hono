import * as Sentry from '@sentry/node'
import { describe, expect, it } from 'vitest'

import { initErrorReporting } from '#/shared/infrastructure/errorReporting.ts'

import { categoryFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'

import { createApp } from '#/app.ts'

import type { NodeOptions } from '@sentry/node'
import type { AppDependencies } from '#/app.ts'

/** DSN factice : l'envoi réseau est remplacé, aucune instance GlitchTip n'est contactée. */
const FAKE_DSN = 'http://cle@glitchtip.test/1'

const sentEnvelopes: string[] = []

/** Vrai transport du SDK (file d'attente, enveloppes), seul l'envoi réseau est remplacé. */
const recordingTransport: NodeOptions['transport'] = (options) =>
  Sentry.createTransport(options, (request) => {
    sentEnvelopes.push(
      typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
    )
    return Promise.resolve({ statusCode: 200 })
  })

const unavailable = (): Promise<never> => Promise.reject(new Error('Base de données injoignable'))

const failingDatabase: AppDependencies = {
  tasks: { findAll: unavailable },
  articles: { findLatestFirst: unavailable },
  contactMessages: { save: unavailable },
  categories: { findAll: () => Promise.resolve(categoryFixtures) },
  products: { search: unavailable },
  slides: { findInOrder: unavailable },
  legalPages: { findBySlug: unavailable },
}

const appWith = (dsn: string | undefined) =>
  createApp(
    failingDatabase,
    { APP_ENV: 'test', CORS_ALLOW_ORIGIN: '^$' },
    initErrorReporting({ GLITCHTIP_DSN: dsn, GLITCHTIP_ENVIRONMENT: 'test' }, recordingTransport),
  )

const sentEvents = async (): Promise<string[]> => {
  await Sentry.flush(2000)
  return sentEnvelopes.filter((envelope) => envelope.includes('"type":"event"'))
}

describe('suivi des erreurs (GlitchTip)', () => {
  it("n'initialise rien et n'envoie rien sans DSN", async () => {
    const response = await appWith(undefined).request('/api/tasks', {
      headers: { Accept: 'application/json' },
    })

    expect(response.status).toBe(500)
    expect(Sentry.getClient()).toBeUndefined()
    expect(await sentEvents()).toEqual([])
  })

  it('envoie une 500 inattendue, sans donnée personnelle ni trace', async () => {
    sentEnvelopes.length = 0
    const response = await appWith(FAKE_DSN).request('/api/tasks', {
      headers: { Accept: 'application/json' },
    })

    expect(response.status).toBe(500)
    const events = await sentEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toContain('Base de données injoignable')
    expect(Sentry.getClient()?.getOptions()).toMatchObject({
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] },
      tracesSampleRate: 0,
      environment: 'test',
    })
  })

  it("n'envoie pas une 422 de validation", async () => {
    sentEnvelopes.length = 0
    const response = await appWith(FAKE_DSN).request('/api/contact_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'camille@', message: 'Court' }),
    })

    expect(response.status).toBe(422)
    expect(await sentEvents()).toEqual([])
  })

  it("n'envoie pas une 500 de désérialisation (JSON invalide)", async () => {
    sentEnvelopes.length = 0
    const response = await appWith(FAKE_DSN).request('/api/contact_messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{bad',
    })

    expect(response.status).toBe(500)
    expect(await sentEvents()).toEqual([])
  })
})
