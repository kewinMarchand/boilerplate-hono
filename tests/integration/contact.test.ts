import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { constraintViolationSchema } from '#/shared/http/problemSchemas.ts'

import { CONTACT_ERRORS, contactMessageContract } from '#/contact/http/contract.ts'

import { createTestContext } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext('contact')
})
afterAll(() => context.close())

const post = (body: string, headers: Record<string, string> = {}) =>
  context.app.request('/api/contact_messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body,
  })

describe('POST /api/contact_messages', () => {
  it('enregistre le message nettoyé et répond 201', async () => {
    const response = await post(
      JSON.stringify({
        name: '  Camille Martin ',
        email: 'camille.martin@example.fr',
        message: 'Bonjour, je souhaite un devis pour une refonte.',
      }),
    )
    const { receivedAt, ...saved } = contactMessageContract.parse(await response.json())

    expect(response.status).toBe(201)
    expect(response.headers.get('location')).toBe('/api/contact_messages/1')
    expect(saved).toEqual({
      id: 1,
      name: 'Camille Martin',
      email: 'camille.martin@example.fr',
      message: 'Bonjour, je souhaite un devis pour une refonte.',
    })
    expect(receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/)

    const document = await context.db
      .collection<{ _id: number; name: string; receivedAt: Date }>('contact_messages')
      .findOne({ _id: 1 })
    expect(document?.name).toBe('Camille Martin')
    expect(document?.receivedAt).toBeInstanceOf(Date)
  })

  it.each([
    [
      'champs absents',
      '{}',
      { name: CONTACT_ERRORS.name, email: CONTACT_ERRORS.email, message: CONTACT_ERRORS.message },
    ],
    [
      'champs vides ou trop courts',
      '{"name":" A ","email":"","message":"  Court   "}',
      { name: CONTACT_ERRORS.name, email: CONTACT_ERRORS.email, message: CONTACT_ERRORS.message },
    ],
    [
      'e-mail invalide seul',
      '{"name":"Camille","email":"camille@","message":"Un message assez long."}',
      { email: CONTACT_ERRORS.email },
    ],
  ])('répond 422 en problem+json : %s', async (_case, payload, expected) => {
    const response = await post(payload)
    const body = constraintViolationSchema.parse(await response.json())

    expect(response.status).toBe(422)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(body).toMatchObject({ status: 422, title: 'An error occurred' })
    expect(
      Object.fromEntries(
        (body.violations ?? []).map(({ propertyPath, message }) => [propertyPath, message]),
      ),
    ).toEqual(expected)
  })

  it('envoie le message de contact par mail à l’adresse de l’identité du site', async () => {
    const response = await post(
      JSON.stringify({
        name: 'Camille Martin',
        email: 'camille@example.fr',
        message: 'Bonjour, je souhaite un devis.',
      }),
    )

    expect(response.status).toBe(201)
    expect(context.mailer.sent.at(-1)).toEqual({
      to: 'contact@example.com',
      replyTo: 'camille@example.fr',
      subject: 'Message de contact : Camille Martin',
      text: 'Nom : Camille Martin\nAdresse : camille@example.fr\n\nMessage :\nBonjour, je souhaite un devis.\n',
    })
  })

  it('enregistre une demande de renseignement et l’envoie avec le nom du produit', async () => {
    const response = await post(
      JSON.stringify({
        name: 'Camille',
        email: 'camille@example.fr',
        message: 'Est-elle disponible en grand pot ?',
        product: 'monstera-deliciosa',
      }),
    )
    const saved = contactMessageContract.parse(await response.json())

    expect(response.status).toBe(201)
    expect(saved.product).toBe('monstera-deliciosa')
    const mail = context.mailer.sent.at(-1)
    expect(mail?.subject).toBe('Demande de renseignement : Monstera deliciosa')
    expect(mail?.text).toContain('Produit : Monstera deliciosa (monstera-deliciosa)')
    const document = await context.db
      .collection<{ _id: number; product: string | null }>('contact_messages')
      .findOne({ _id: saved.id ?? 0 })
    expect(document?.product).toBe('monstera-deliciosa')
  })

  it('ne vérifie le produit qu’une fois les champs de texte valides, comme l’API Platform', async () => {
    const response = await post(
      JSON.stringify({
        name: 'C',
        email: 'camille@example.fr',
        message: 'Un message.',
        product: 'x',
      }),
    )
    const body = constraintViolationSchema.parse(await response.json())

    expect(response.status).toBe(422)
    expect(body.violations?.map(({ propertyPath }) => propertyPath)).toEqual(['name'])
  })

  it('refuse un produit inconnu en 422 sur product, sans rien enregistrer ni envoyer', async () => {
    const sent = context.mailer.sent.length
    const before = await context.db.collection('contact_messages').countDocuments()
    const response = await post(
      JSON.stringify({
        name: 'Camille',
        email: 'camille@example.fr',
        message: 'Est-elle disponible ?',
        product: 'plante-inconnue',
      }),
    )

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      violations: [{ propertyPath: 'product', message: "Ce produit n'existe pas.", code: null }],
      detail: "product: Ce produit n'existe pas.",
    })
    expect(await context.db.collection('contact_messages').countDocuments()).toBe(before)
    expect(context.mailer.sent).toHaveLength(sent)
  })

  it('répond 201 et garde le message quand l’envoi du mail échoue, erreur journalisée', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    context.mailer.failure = new Error('SMTP injoignable')
    try {
      const response = await post(
        JSON.stringify({
          name: 'Camille',
          email: 'camille@example.fr',
          message: 'Un message qui part en erreur.',
        }),
      )
      const saved = contactMessageContract.parse(await response.json())

      expect(response.status).toBe(201)
      expect(
        await context.db
          .collection<{ _id: number; message: string }>('contact_messages')
          .findOne({ _id: saved.id ?? 0 }),
      ).toMatchObject({ message: 'Un message qui part en erreur.' })
      expect(log).toHaveBeenCalledWith(
        'Envoi du mail du message de contact en échec',
        context.mailer.failure,
      )
    } finally {
      context.mailer.failure = null
      log.mockRestore()
    }
  })

  it('répond 500 à un produit qui n’est pas une chaîne, comme le serializer de l’API Platform', async () => {
    const response = await post(
      '{"name":"Camille","email":"camille@example.fr","message":"Un message.","product":3}',
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      detail: 'The type of the "product" attribute must be "null|string", "integer" given.',
    })
  })

  it('répond 500 « Syntax error » sur un JSON invalide, comme API Platform', async () => {
    const response = await post('{bad')

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ detail: 'Syntax error' })
  })

  it('répond 413 en problem+json à un corps de plus de 64 Ko', async () => {
    const response = await post(
      JSON.stringify({ name: 'Camille', email: 'a@b.fr', message: 'm'.repeat(70000) }),
    )

    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toBe('application/problem+json')
    expect(await response.json()).toMatchObject({
      detail: 'Le corps de la requête ne doit pas dépasser 64 Ko.',
    })
  })

  it('répond 415 à un autre type de contenu', async () => {
    const response = await post('{}', { 'Content-Type': 'text/plain' })

    expect(response.status).toBe(415)
  })
})
