import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext
let cookie = ''
let inquiryId = 0

const ORIGIN = 'http://localhost'
const MESSAGE = `Est-il livré en pot ? <b class="piege">Merci</b> ${'Une précision de plus. '.repeat(5)}Fin du message.`

beforeAll(async () => {
  context = await createTestContext('admin_contact')
  const repositories = createRepositories(context.db, mediaDependencies(TEST_MEDIA_DIR))
  await saveAdmin(repositories, 'admin@exemple.fr', 'mot-de-passe-solide')
  await repositories.contactMessages.save({
    name: 'Alex Contact',
    email: 'alex@example.fr',
    message: 'Bonjour, un simple message.',
    product: null,
    receivedAt: new Date('2100-01-01T12:00:00Z'),
  })
  inquiryId = (
    await repositories.contactMessages.save({
      name: 'Camille Demande',
      email: 'camille@example.fr',
      message: MESSAGE,
      product: 'monstera-deliciosa',
      receivedAt: new Date('2100-01-02T08:30:00Z'),
    })
  ).id
  const login = await context.app.request(`${ORIGIN}/admin/login`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: 'admin@exemple.fr',
      password: 'mot-de-passe-solide',
    }).toString(),
  })
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? ''
})
afterAll(() => context.close())

const get = (path: string, withSession = true) =>
  context.app.request(`${ORIGIN}${path}`, { headers: withSession ? { Cookie: cookie } : {} })

const rows = (page: string) => page.split('<tbody>')[1]?.split('</tr>') ?? []

describe('Admin : messages reçus', () => {
  it('renvoie à la connexion sans session', async () => {
    for (const path of ['/admin/messages', `/admin/messages/${inquiryId}`]) {
      const response = await get(path, false)
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('/admin/login')
    }
  })

  it('liste les messages du plus récent au plus ancien, avec un extrait', async () => {
    const response = await get('/admin/messages')
    expect(response.status).toBe(200)
    const page = await response.text()
    expect(page).toContain('<a href="/admin/messages" aria-current="page">Messages</a>')

    const [latest = '', older = ''] = rows(page)
    expect(latest).toContain('Camille Demande')
    expect(latest).toContain('02/01/2100 09:30')
    expect(latest).toContain('monstera-deliciosa')
    expect(latest).toContain('Est-il livré en pot ? &lt;b class=&quot;piege&quot;&gt;Merci')
    expect(latest).toContain('…')
    expect(latest).not.toContain('Fin du message.')
    expect(latest).toContain(`href="/admin/messages/${inquiryId}"`)
    expect(older).toContain('Alex Contact')
    expect(older).toContain('alex@example.fr')
    expect(older).toContain('<td>Aucun</td>')
    expect(page).not.toMatch(/<form method="post" action="\/admin\/messages/)
  })

  it('montre un message en entier, échappé', async () => {
    const response = await get(`/admin/messages/${inquiryId}`)
    expect(response.status).toBe(200)
    const page = await response.text()
    expect(page).toContain('<h1>Message de Camille Demande</h1>')
    expect(page).toContain('Fin du message.')
    expect(page).toContain('&lt;b class=&quot;piege&quot;&gt;Merci&lt;/b&gt;')
    expect(page).not.toContain('<b class="piege">')
  })

  it('répond 404 à un message inconnu', async () => {
    expect((await get('/admin/messages/999999')).status).toBe(404)
  })
})
