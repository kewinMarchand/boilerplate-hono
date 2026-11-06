import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'
import { ADMIN_CSP } from '#/admin/http/adminRoutes.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext

const EMAIL = 'admin@exemple.fr'
const PASSWORD = 'mot-de-passe-solide'
const ORIGIN = 'http://localhost'

beforeAll(async () => {
  context = await createTestContext('admin')
  await saveAdmin(
    createRepositories(context.db, mediaDependencies(TEST_MEDIA_DIR)),
    EMAIL,
    PASSWORD,
  )
})
afterAll(() => context.close())

const login = (email: string, password: string, origin: string = ORIGIN) =>
  context.app.request(`${ORIGIN}/admin/login`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password }).toString(),
  })

const sessionCookie = (response: Response): string =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? ''

describe('Admin : connexion', () => {
  it('renvoie à la connexion sans session, et sert la page de connexion en HTML', async () => {
    const dashboard = await context.app.request(`${ORIGIN}/admin`)
    expect(dashboard.status).toBe(302)
    expect(dashboard.headers.get('location')).toBe('/admin/login')

    const page = await context.app.request(`${ORIGIN}/admin/login`)
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toMatch(/^text\/html/)
    expect(page.headers.get('content-security-policy')).toBe(ADMIN_CSP)
    expect(await page.text()).toContain('<label for="email">Adresse e-mail</label>')
  })

  it('refuse de mauvais identifiants sans ouvrir de session', async () => {
    const response = await login(EMAIL, 'mauvais-mot-de-passe')

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await response.text()).toContain('Identifiants invalides.')
  })

  it('ouvre une session, sert le tableau de bord, puis la ferme', async () => {
    const response = await login(EMAIL, PASSWORD)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/admin')
    const setCookie = response.headers.get('set-cookie') ?? ''
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/SameSite=Strict/)

    const cookie = sessionCookie(response)
    const dashboard = await context.app.request(`${ORIGIN}/admin`, { headers: { Cookie: cookie } })
    expect(dashboard.status).toBe(200)
    expect(await dashboard.text()).toContain(`Connecté : ${EMAIL}`)

    const logout = await context.app.request(`${ORIGIN}/admin/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: cookie },
    })
    expect(logout.status).toBe(303)
    expect(logout.headers.get('set-cookie')).toMatch(/Max-Age=0/)
  })

  it('refuse un cookie de session falsifié', async () => {
    const response = await context.app.request(`${ORIGIN}/admin`, {
      headers: { Cookie: `admin_session=${encodeURIComponent(`${EMAIL}|9999999999999.faux`)}` },
    })

    expect(response.status).toBe(302)
  })

  it('refuse un formulaire envoyé depuis une autre origine (CSRF)', async () => {
    const response = await login(EMAIL, PASSWORD, 'http://site-malveillant.example')

    expect(response.status).toBe(403)
  })

  it('bloque une adresse après 5 échecs', async () => {
    const email = 'cible@exemple.fr'
    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await login(email, 'mauvais-mot-de-passe')).status).toBe(401)
    }

    const blocked = await login(email, 'mauvais-mot-de-passe')
    expect(blocked.status).toBe(429)
    expect(await blocked.text()).toContain('Plusieurs tentatives de connexion ont échoué')
  })

  it("n'apparaît pas dans le contrat public", async () => {
    const response = await context.app.request('/api/docs.jsonopenapi')
    const document: unknown = await response.json()

    expect(JSON.stringify(document)).not.toContain('/admin')
  })
})
