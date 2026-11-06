import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext
let cookie = ''

const ORIGIN = 'http://localhost'

beforeAll(async () => {
  context = await createTestContext('admin_contenus')
  await saveAdmin(
    createRepositories(context.db, mediaDependencies(TEST_MEDIA_DIR)),
    'admin@exemple.fr',
    'mot-de-passe-solide',
  )
  const login = await post('/admin/login', {
    email: 'admin@exemple.fr',
    password: 'mot-de-passe-solide',
  })
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
})
afterAll(() => context.close())

function post(path: string, fields: Record<string, string>, withSession = true) {
  return context.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(withSession && cookie !== '' ? { Cookie: cookie } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  })
}

/** Formulaire multipart avec un fichier, comme l'envoie le navigateur. */
function postFile(path: string, fields: Record<string, string>, file?: Uint8Array) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  if (file !== undefined) {
    form.set('imageContent', new File([Buffer.from(file)], 'photo.webp', { type: 'image/webp' }))
  }
  return context.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: cookie },
    body: form,
  })
}

const demoPhoto = async (name: string) =>
  new Uint8Array(await readFile(new URL(`../../fixtures/images/${name}.webp`, import.meta.url)))

const page = (path: string) =>
  context.app.request(`${ORIGIN}${path}`, { headers: { Cookie: cookie } })

const apiText = async (path: string): Promise<string> =>
  JSON.stringify(
    await (await context.app.request(path, { headers: { Accept: 'application/json' } })).json(),
  )

describe('Admin : contenus', () => {
  it('renvoie à la connexion sans session, même en envoi de formulaire', async () => {
    const response = await post('/admin/pages-legales/mentions-legales/modifier', {}, false)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin/login')
  })

  it('liste les articles, les diapositives et les pages légales', async () => {
    expect(await (await page('/admin/articles')).text()).toContain('<table>')
    expect(await (await page('/admin/carrousel')).text()).toContain('Heliconia')
    expect(await (await page('/admin/pages-legales')).text()).toContain('Mentions légales')
  })

  it('répond 404 en HTML sur un article, une diapositive ou une page inconnus', async () => {
    for (const response of [
      await page('/admin/articles/999/modifier'),
      await page('/admin/carrousel/999/supprimer'),
      await page('/admin/pages-legales/cgv/modifier'),
      await post('/admin/carrousel/abc/modifier', {}),
    ]) {
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('Page introuvable')
    }
  })

  it('refuse un formulaire mal rempli, champ par champ', async () => {
    const response = await post('/admin/carrousel/nouveau', {
      title: '',
      slug: 'Pas Un Slug',
      text: '',
      position: 'x',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('Cette valeur ne doit pas être vide.')
    expect(body).toContain('Cette valeur doit être un nombre entier.')
    expect(body).toContain('aria-invalid="true"')
  })

  it('annonce une règle des contenus enfreinte', async () => {
    const response = await post('/admin/carrousel/nouveau', {
      title: 'Doublon',
      slug: 'heliconia',
      text: '',
      position: '9',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Le slug « heliconia » est déjà pris par une autre diapositive.',
    )
  })

  it('crée, modifie et supprime une diapositive, visible aussitôt dans l’API', async () => {
    const created = await postFile(
      '/admin/carrousel/nouveau',
      {
        title: 'Hibiscus',
        slug: 'hibiscus',
        text: 'Une fleur d’un jour.',
        position: '0',
        imageAlt: 'Fleur rouge d’hibiscus',
      },
      await demoPhoto('slide-2'),
    )
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/admin/carrousel?ok=cree')
    expect(await (await page('/admin/carrousel?ok=cree')).text()).toContain('Diapositive créée.')

    const slides = await apiText('/api/slides')
    expect(slides.indexOf('"slug":"hibiscus"')).toBeLessThan(slides.indexOf('"slug":"heliconia"'))
    const id = /"id":(\d+),"slug":"hibiscus"/.exec(slides)?.[1] ?? ''
    expect(Number(id)).toBeGreaterThan(5)
    expect(slides).toContain('"alt":"Fleur rouge d’hibiscus"')

    const updated = await postFile(`/admin/carrousel/${id}/modifier`, {
      title: 'Hibiscus rouge',
      slug: 'hibiscus',
      text: '',
      position: '9',
      imageAlt: 'Hibiscus en fleur',
    })
    expect(updated.status).toBe(303)
    const afterUpdate = await apiText('/api/slides')
    expect(afterUpdate).toContain('Hibiscus rouge')
    expect(afterUpdate).toContain('"alt":"Hibiscus en fleur"')

    expect((await page(`/admin/carrousel/${id}/supprimer`)).status).toBe(200)
    expect((await post(`/admin/carrousel/${id}/supprimer`, {})).status).toBe(303)
    expect(await apiText('/api/slides')).not.toContain('hibiscus')
  })

  it('refuse une image trop petite une fois recadrée, avec le message de l’API Platform', async () => {
    const small = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#c81e1e' },
    })
      .png()
      .toBuffer()
    const response = await postFile(
      '/admin/carrousel/nouveau',
      { title: 'Trop petite', slug: 'trop-petite', text: '', position: '9', imageAlt: 'Une photo' },
      new Uint8Array(small),
    )

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Recadrée au format 16:9, l&#39;image doit faire au moins 1280 × 720 px : elle fait 640 × 360 px.',
    )
  })

  it('modifie une page légale : le Markdown est rendu et découpé dans l’API', async () => {
    const response = await post('/admin/pages-legales/mentions-legales/modifier', {
      title: 'Mentions légales',
      body: 'Intro <b>gras</b>\n\n## Éditeur\n\n[Site](https://example.com) [x](javascript:alert(1))',
    })
    expect(response.status).toBe(303)

    const legal = await apiText('/api/legal_pages/mentions-legales')
    expect(legal).toContain('<p>Intro &lt;b&gt;gras&lt;/b&gt;</p>')
    expect(legal).toContain('"title":"Éditeur"')
    expect(legal).toContain('<a href=\\"https://example.com\\">Site</a>')
    expect(legal).not.toContain('href=\\"javascript:')
  })
})
