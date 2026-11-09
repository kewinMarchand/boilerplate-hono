import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

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

/** Formulaire multipart avec des fichiers nommés par champ. */
function postFiles(path: string, fields: Record<string, string>, files: Record<string, File>) {
  const form = new FormData()
  for (const [name, value] of Object.entries({ ...fields, ...files })) {
    form.set(name, value)
  }
  return context.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: cookie },
    body: form,
  })
}

const audioFile = (name: string, type: string) =>
  new File([readFileSync(new URL(`../fixtures/audio/${name}`, import.meta.url))], name, { type })

/** Champs de l'article 3 des fixtures, image décorative gardée. */
const ARTICLE_3 = {
  title: 'Le mode accessibilité renforcée',
  slug: 'le-mode-accessibilite-renforcee',
  publishedAt: '2026-10-01',
  imageDecorative: 'on',
  sectionId: '2',
}

const page = (path: string) =>
  context.app.request(`${ORIGIN}${path}`, { headers: { Cookie: cookie } })

const apiJson = async <T>(path: string, schema: z.ZodType<T>): Promise<T> =>
  schema.parse(
    await (await context.app.request(path, { headers: { Accept: 'application/json' } })).json(),
  )

const slugs = z.array(z.object({ slug: z.string() }))
const ids = z.array(z.object({ id: z.int() }))
const articleDetail = z.object({
  format: z.object({ slug: z.string() }).nullable(),
  audio: z.object({ src: z.string(), type: z.string(), durationSeconds: z.int() }).nullable(),
  speaker: z.string(),
  metaDescription: z.string(),
})

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
    expect(await (await page('/admin/articles/nouveau')).text()).toMatch(
      /<figure\s+data-apercu="imageContent"\s+data-choisie="[^"]+"\s+hidden\s*>/,
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

  it('gère les rubriques et refuse de supprimer celle qu’utilisent des articles', async () => {
    const created = await post('/admin/rubriques/nouveau', {
      name: 'Jardin',
      slug: 'jardin',
      position: '3',
    })
    expect(created.status).toBe(303)
    expect((await apiJson('/api/article-sections', slugs)).map(({ slug }) => slug)).toEqual([
      'conseils',
      'actualites',
      'jardin',
    ])
    expect(await (await page('/admin/rubriques')).text()).not.toContain('Guide')

    const refused = await post('/admin/rubriques/1/supprimer', {})
    expect(refused.status).toBe(422)
    expect(await refused.text()).toContain('La rubrique Conseils est utilisée par 2 articles.')
    expect((await post('/admin/rubriques/4/supprimer', {})).status).toBe(303)
    expect(await apiText('/api/article-sections')).not.toContain('jardin')
  })

  it('refuse un slug de format déjà pris', async () => {
    const response = await post('/admin/formats/nouveau', {
      name: 'Guide bis',
      slug: 'guide',
      position: '2',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain('Le slug « guide » est déjà pris par un autre format.')
  })

  it('classe un article, lui envoie un fichier audio, puis le retire', async () => {
    expect(await (await page('/admin/articles/3/modifier')).text()).not.toContain(
      'data-apercu-audio',
    )
    const saved = await postFiles(
      '/admin/articles/3/modifier',
      {
        ...ARTICLE_3,
        formatId: '3',
        speaker: 'Présenté par Camille Exemple',
        metaDescription: 'Texte agrandi et contraste AAA.',
      },
      { audioContent: audioFile('beep-3s.m4a', 'audio/mp4') },
    )
    expect(saved.status).toBe(303)

    const detail = await apiJson('/api/articles/le-mode-accessibilite-renforcee', articleDetail)
    expect([
      detail.format?.slug,
      detail.audio?.type,
      detail.audio?.durationSeconds,
      detail.speaker,
      detail.metaDescription,
    ]).toEqual([
      'guide',
      'audio/mp4',
      3,
      'Présenté par Camille Exemple',
      'Texte agrandi et contraste AAA.',
    ])
    const src = detail.audio?.src ?? ''
    expect(src).toMatch(/^http:\/\/localhost:8091\/media\/[0-9a-f]{32}\.m4a$/)
    const served = await context.app.request(new URL(src).pathname, {
      headers: { Range: 'bytes=0-9' },
    })
    expect([served.status, served.headers.get('content-type')]).toEqual([206, 'audio/mp4'])
    expect((await apiJson('/api/articles?format=guide', ids)).map(({ id }) => id)).toEqual([3, 1])

    expect(await (await page('/admin/articles/3/modifier')).text()).toContain(
      'Fichier audio actuel, M4A, 3 s',
    )
    await post('/admin/articles/3/modifier', { ...ARTICLE_3, removeAudio: 'on' })
    expect(
      (await apiJson('/api/articles/le-mode-accessibilite-renforcee', articleDetail)).audio,
    ).toBeNull()
  })

  it('refuse un fichier qui n’est pas de l’audio', async () => {
    const response = await postFiles('/admin/articles/3/modifier', ARTICLE_3, {
      audioContent: audioFile('video-1s.mp4', 'video/mp4'),
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Le fichier ne se lit pas comme un fichier audio MP3, M4A ou OGG.',
    )
  })

  it('modifie le référencement d’une page fixe, sans création ni longueur dépassée', async () => {
    const list = await (await page('/admin/referencement')).text()
    expect(list).toContain('Données personnelles')
    expect(list).not.toContain('nouveau')

    const saved = await post('/admin/referencement/home/modifier', {
      title: 'Oraki, plantes rares',
      description: 'Plantes tropicales livrées chez vous.',
    })
    expect(saved.status).toBe(303)
    const metas = z.array(
      z.object({ page: z.string(), title: z.string(), description: z.string() }),
    )
    expect((await apiJson('/api/page-metas', metas))[0]).toEqual({
      page: 'home',
      title: 'Oraki, plantes rares',
      description: 'Plantes tropicales livrées chez vous.',
    })

    const refused = await post('/admin/referencement/home/modifier', { title: 'a'.repeat(61) })
    expect(refused.status).toBe(422)
    expect((await page('/admin/referencement/inconnue/modifier')).status).toBe(404)
  })
})
