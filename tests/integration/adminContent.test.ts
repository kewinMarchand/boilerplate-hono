import { createHash } from 'node:crypto'
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

  it('liste les articles et les pages légales', async () => {
    expect(await (await page('/admin/articles')).text()).toContain('<table>')
    expect(await (await page('/admin/pages-legales')).text()).toContain('Mentions légales')
  })

  it('montre la plus petite variante de chaque image dans les listes', async () => {
    expect(await (await page('/admin/articles')).text()).toMatch(
      /<img\s+src="\/media\/[0-9a-f]{32}-480\.webp"\s+alt=""/,
    )
  })

  it('montre l’image actuelle dans le formulaire, y compris après un refus', async () => {
    const current = /src="\/media\/[0-9a-f]{32}-480\.webp"\s+alt=""\s+class="apercu"/

    expect(await (await page('/admin/articles/1/modifier')).text()).toMatch(current)
    const refused = await post('/admin/articles/1/modifier', { title: '', slug: 'article' })
    expect(refused.status).toBe(422)
    expect(await refused.text()).toMatch(current)
    expect(await (await page('/admin/articles/nouveau')).text()).toContain(
      '<figure id="apercu-image" hidden>',
    )
  })

  it('autorise par la CSP le script d’aperçu servi, et lui seul', async () => {
    const response = await page('/admin/articles/1/modifier')
    const script = /<script>([\s\S]*?)<\/script>/.exec(await response.text())?.[1] ?? ''
    const hash = createHash('sha256').update(script).digest('base64')

    expect(script).toContain('URL.createObjectURL')
    expect(response.headers.get('content-security-policy')).toContain(
      `script-src 'sha256-${hash}';`,
    )
  })

  it('répond 404 en HTML sur un article ou une page inconnus', async () => {
    for (const response of [
      await page('/admin/articles/999/modifier'),
      await page('/admin/articles/999/supprimer'),
      await page('/admin/pages-legales/cgv/modifier'),
      await post('/admin/articles/abc/modifier', {}),
    ]) {
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('Page introuvable')
    }
  })

  it('refuse un formulaire mal rempli, champ par champ', async () => {
    const response = await post('/admin/articles/nouveau', {
      title: '',
      slug: 'Pas Un Slug',
      publishedAt: 'x',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('Cette valeur ne doit pas être vide.')
    expect(body).toContain('Veuillez entrer une date valide.')
    expect(body).toContain('aria-invalid="true"')
  })

  it('annonce une règle des contenus enfreinte', async () => {
    const response = await post('/admin/pages-legales/cgv/modifier', {
      title: 'CGV',
      body: 'Conditions.',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain('Cette page n&#39;existe plus.')
  })

  it('refuse une image trop petite une fois recadrée, avec le message de l’API Platform', async () => {
    const small = await sharp({
      create: { width: 640, height: 360, channels: 3, background: '#c81e1e' },
    })
      .png()
      .toBuffer()
    const response = await postFile(
      '/admin/articles/nouveau',
      {
        title: 'Trop petite',
        slug: 'trop-petite',
        publishedAt: '2026-11-07',
        imageAlt: 'Une photo',
      },
      new Uint8Array(small),
    )

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Recadrée au format 16:9, l&#39;image doit faire au moins 960 × 540 px : elle fait 640 × 360 px.',
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
