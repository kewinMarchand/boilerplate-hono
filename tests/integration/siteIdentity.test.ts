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

/**
 * Fixtures : valeurs du modèle, sans logo, image de partage, icône ni couleurs
 * (SiteIdentityApiTest::DEFAULT de l'API Platform).
 */
const DEFAULT = {
  name: 'Boilerplate',
  tagline: 'Modèle de site avec boilerplates-ui, outillé pour la QA et les tests end-to-end.',
  logo: null,
  shareImage: null,
  icon: null,
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

/** Formulaire multipart, comme l'envoie le navigateur, avec un logo facultatif et d'autres fichiers par champ. */
const submit = (
  fields: Record<string, string>,
  logo?: Buffer,
  withSession = true,
  files: Record<string, Buffer> = {},
) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  for (const [name, content] of Object.entries({
    ...(logo === undefined ? {} : { imageContent: logo }),
    ...files,
  })) {
    form.set(name, new File([Buffer.from(content)], `${name}.png`, { type: 'image/png' }))
  }
  return context.app.request(`${ORIGIN}${PATH}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, ...(withSession ? { Cookie: cookie } : {}) },
    body: form,
  })
}

const page = () => context.app.request(`${ORIGIN}${PATH}`, { headers: { Cookie: cookie } })

const transparentPng = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .png()
    .toBuffer()

const transparentLogo = () => transparentPng(800, 240)

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

    const removed = await submit({ ...FIELDS, removeLogo: 'on', useLibraryColors: 'on' })
    expect(removed.status).toBe(303)
    expect((await getJson(context, '/api/site-identity')).body).toMatchObject({
      logo: null,
      theme: null,
    })
  })

  it('montre le logo actuel et son texte au-dessus du champ d’envoi', async () => {
    await submit({ ...FIELDS, imageAlt: 'Oraki, plantes rares' }, await transparentLogo())
    const body = await (await page()).text()
    await submit({ ...FIELDS, removeLogo: 'on', useLibraryColors: 'on' })

    expect(body).toMatch(
      /<figure data-apercu="imageContent"\s*>\s*<img\s+src="\/media\/[0-9a-f]{32}-200\.webp"/,
    )
    expect(body).toContain('Logo actuel, texte de remplacement : « Oraki, plantes rares »')
    expect(body.indexOf('data-apercu="imageContent"')).toBeLessThan(
      body.indexOf('<label for="imageContent">'),
    )
    expect(body).toContain('<figure data-apercu="iconContent" hidden>')
  })

  it('montre les couleurs en sélecteur natif derrière la case « couleurs de la bibliothèque », cochée sans couleurs', async () => {
    const body = await (await page()).text()

    expect(body).toMatch(/id="primaryColor"\s+name="primaryColor"\s+type="color"/)
    expect(body).toMatch(/id="secondaryColor"\s+name="secondaryColor"\s+type="color"/)
    expect(body).toMatch(/name="useLibraryColors"[^>]*checked/)
  })

  it('ignore les couleurs saisies quand la case « couleurs de la bibliothèque » est cochée', async () => {
    const response = await submit({ ...FIELDS, primaryColor: '#ffff00', useLibraryColors: 'on' })

    expect(response.status).toBe(303)
    expect((await getJson(context, '/api/site-identity')).body).toMatchObject({ theme: null })
  })

  it('enregistre puis retire l’icône (favicons PNG) et l’image de partage', async () => {
    const saved = await submit({ ...FIELDS, shareImageAlt: 'Serre tropicale' }, undefined, true, {
      iconContent: await transparentPng(600, 512),
      shareImageContent: await transparentPng(1200, 630),
    })
    expect(saved.status).toBe(303)

    const { body } = await getJson(context, '/api/site-identity')
    expect(body).toMatchObject({ shareImage: { alt: 'Serre tropicale', width: 1200, height: 630 } })
    expect(JSON.stringify(body)).toMatch(
      /"icon":\{"png32":"http:\/\/localhost:8091\/media\/[0-9a-f]{32}-32\.png","png180":"[^"]+-180\.png","png192":"[^"]+-192\.png","png512":"[^"]+-512\.png"\}/,
    )
    expect(await (await page()).text()).toContain('Icône actuelle (192 px)')

    await submit({ ...FIELDS, removeIcon: 'on', removeShareImage: 'on' })
    expect((await getJson(context, '/api/site-identity')).body).toMatchObject({
      shareImage: null,
      icon: null,
    })
  })

  it('refuse une icône de moins de 512 px', async () => {
    const response = await submit(FIELDS, undefined, true, {
      iconContent: await transparentPng(256, 256),
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Recadrée au format 1:1, l&#39;image doit faire au moins 512 × 512 px : elle fait 256 × 256 px.',
    )
  })

  it('sert l’identité par défaut avec X-Scenario: empty, quelle que soit celle enregistrée', async () => {
    await submit(FIELDS)

    const { body } = await getJson(context, '/api/site-identity', { 'X-Scenario': 'empty' })

    expect(body).toEqual(DEFAULT)
  })
})
