import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, getJson, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext
let cookie = ''

const ORIGIN = 'http://localhost'
const PATH = '/admin/identite-du-site'

/** Fixtures : valeurs du modèle, sans logo ni couleurs (SiteIdentityApiTest::DEFAULT de l'API Platform). */
const DEFAULT = {
  name: 'Boilerplate',
  tagline: 'Modèle de site avec boilerplates-ui, outillé pour la QA et les tests end-to-end.',
  logo: null,
  defaultColorScheme: 'auto',
  theme: null,
}

const FIELDS = {
  name: 'Oraki',
  tagline: 'Plantes rares et tropicales, livrées chez vous.',
  primaryColor: '#c2410c',
  secondaryColor: '#ffffff',
  defaultColorScheme: 'dark',
}

beforeAll(async () => {
  context = await createTestContext('identite_du_site')
  await saveAdmin(
    createRepositories(context.db, mediaDependencies(TEST_MEDIA_DIR)),
    'admin@exemple.fr',
    'mot-de-passe-solide',
  )
  const form = new URLSearchParams({ email: 'admin@exemple.fr', password: 'mot-de-passe-solide' })
  const login = await context.app.request(`${ORIGIN}/admin/login`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
})
afterAll(() => context.close())

/** Formulaire multipart, comme l'envoie le navigateur, avec un logo facultatif. */
const submit = (fields: Record<string, string>, logo?: Buffer, withSession = true) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  if (logo !== undefined) {
    form.set('imageContent', new File([Buffer.from(logo)], 'logo.png', { type: 'image/png' }))
  }
  return context.app.request(`${ORIGIN}${PATH}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, ...(withSession ? { Cookie: cookie } : {}) },
    body: form,
  })
}

const page = () => context.app.request(`${ORIGIN}${PATH}`, { headers: { Cookie: cookie } })

const transparentLogo = () =>
  sharp({
    create: { width: 800, height: 240, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer()

describe('Identité du site', () => {
  it('lit l’identité des fixtures', async () => {
    const { response, body } = await getJson(context, '/api/site-identity')

    expect(response.status).toBe(200)
    expect(body).toEqual(DEFAULT)
  })

  it('est en lecture seule', async () => {
    const response = await context.app.request('/api/site-identity', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{"name":"Autre nom"}',
    })

    expect(response.status).toBe(405)
  })

  it('répond 500 avec X-Scenario: error', async () => {
    const { response } = await getJson(context, '/api/site-identity', { 'X-Scenario': 'error' })

    expect(response.status).toBe(500)
  })

  it('renvoie à la connexion sans session', async () => {
    const response = await submit(FIELDS, undefined, false)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin/login')
  })

  it('montre le formulaire, sans case « décorative » pour le logo', async () => {
    const body = await (await page()).text()

    expect(body).toContain('value="Boilerplate"')
    expect(body).toContain('<label for="imageContent">Logo</label>')
    expect(body).toContain('sans recadrage, 400 px de large au moins. Pas de SVG.')
    expect(body).not.toContain('imageDecorative')
  })

  it('refuse une couleur principale illisible sur le fond clair', async () => {
    const response = await submit({ ...FIELDS, primaryColor: '#ffff00' })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'La couleur principale doit contraster à 4,5:1 au moins avec le fond clair (actuellement 1,07:1).',
    )
    expect((await getJson(context, '/api/site-identity')).body).toEqual(DEFAULT)
  })

  it('refuse une seule couleur', async () => {
    const response = await submit({ ...FIELDS, secondaryColor: '' })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain('Saisir les deux couleurs, ou aucune.')
  })

  it('refuse un nom vide ou trop long, champ par champ', async () => {
    const empty = await submit({ ...FIELDS, name: '' })
    const long = await submit({ ...FIELDS, name: 'x'.repeat(61), tagline: 'y'.repeat(161) })
    const longBody = await long.text()

    expect(empty.status).toBe(422)
    expect(await empty.text()).toContain('Cette valeur ne doit pas être vide.')
    expect(longBody).toContain('Elle doit avoir au maximum 60 caractères.')
    expect(longBody).toContain('Elle doit avoir au maximum 160 caractères.')
  })

  it('enregistre l’identité lue par l’API, puis retire le logo et les couleurs', async () => {
    const saved = await submit(FIELDS, await transparentLogo())
    expect(saved.status).toBe(303)
    expect(saved.headers.get('location')).toBe(`${PATH}?ok=modifie`)

    const { body } = await getJson(context, '/api/site-identity')
    expect(body).toMatchObject({
      name: 'Oraki',
      tagline: 'Plantes rares et tropicales, livrées chez vous.',
      defaultColorScheme: 'dark',
      logo: { alt: 'Oraki', width: 400, height: 120 },
      theme: {
        light: { primary: '#c2410c', 'on-primary': '#ffffff' },
        dark: { 'on-primary': '#0f141d' },
      },
    })
    expect(JSON.stringify(body)).toMatch(
      /"src":"http:\/\/localhost:8091\/media\/[0-9a-f]{32}-200\.webp"/,
    )
    expect(await (await page()).text()).toMatch(/src="\/media\/[0-9a-f]{32}-200\.webp"/)

    const removed = await submit({
      ...FIELDS,
      removeLogo: 'on',
      primaryColor: '',
      secondaryColor: '',
    })
    expect(removed.status).toBe(303)
    expect((await getJson(context, '/api/site-identity')).body).toMatchObject({
      logo: null,
      theme: null,
    })
  })

  it('sert l’identité par défaut avec X-Scenario: empty, quelle que soit celle enregistrée', async () => {
    await submit(FIELDS)

    const { body } = await getJson(context, '/api/site-identity', { 'X-Scenario': 'empty' })

    expect(body).toEqual(DEFAULT)
  })
})
