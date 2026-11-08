import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { saveAdmin } from '#/admin/application/adminAccounts.ts'

import { createRepositories, mediaDependencies } from '#/database.ts'

import { createTestContext, TEST_MEDIA_DIR } from './context.ts'

import type { TestContext } from './context.ts'

let context: TestContext
let cookie = ''

const ORIGIN = 'http://localhost'

beforeAll(async () => {
  context = await createTestContext('admin_catalogue')
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
async function postProductWithPhoto(path: string, fields: Record<string, string>) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  const photo = await readFile(new URL('../../fixtures/images/product-3.webp', import.meta.url))
  form.set('imageContent', new File([photo], 'photo.webp', { type: 'image/webp' }))
  return context.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { Origin: ORIGIN, Cookie: cookie },
    body: form,
  })
}

const page = (path: string) =>
  context.app.request(`${ORIGIN}${path}`, { headers: { Cookie: cookie } })

const apiJson = async (path: string): Promise<unknown> =>
  (await context.app.request(path, { headers: { Accept: 'application/json' } })).json()

const slugsOf = (value: unknown): string[] =>
  JSON.stringify(value)
    .match(/"slug":"[^"]+"/g)
    ?.map((s) => s.slice(8, -1)) ?? []

describe('Admin : catalogue', () => {
  it('renvoie à la connexion sans session, même en envoi de formulaire', async () => {
    const response = await post(
      '/admin/categories/nouvelle',
      { name: 'X', slug: 'x', position: '0' },
      false,
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/admin/login')
  })

  it('liste les catégories et les produits', async () => {
    const categories = await page('/admin/categories')
    expect(categories.status).toBe(200)
    expect(await categories.text()).toContain('Plantes d’intérieur')

    const products = await page('/admin/produits')
    expect(products.status).toBe(200)
    expect(await products.text()).toContain('Monstera deliciosa')
  })

  it('montre l’image des produits dans la liste et dans le formulaire', async () => {
    expect(await (await page('/admin/produits')).text()).toMatch(
      /<img\s+src="\/media\/[0-9a-f]{32}-400\.webp"\s+alt=""/,
    )
    expect(await (await page('/admin/produits/1/modifier')).text()).toMatch(
      /src="\/media\/[0-9a-f]{32}-400\.webp"\s+alt=""\s+class="apercu"/,
    )
  })

  it('répond 404 en HTML sur une catégorie ou un produit inconnu', async () => {
    for (const response of [
      await page('/admin/categories/inconnue/modifier'),
      await page('/admin/produits/999/modifier'),
      await post('/admin/produits/abc/supprimer', {}),
    ]) {
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('Page introuvable')
    }
  })

  it('refuse un formulaire mal rempli, champ par champ', async () => {
    const response = await post('/admin/categories/nouvelle', {
      name: '',
      slug: 'Pas Un Slug',
      position: '-1',
    })
    const body = await response.text()

    expect(response.status).toBe(422)
    expect(body).toContain('Cette valeur ne doit pas être vide.')
    expect(body).toContain('Minuscules, chiffres et tirets seulement.')
    expect(body).toContain('Cette valeur doit être positive ou nulle.')
    expect(body).toContain('aria-invalid="true"')
  })

  it('annonce une règle du catalogue enfreinte', async () => {
    const response = await post('/admin/categories/nouvelle', {
      name: 'Doublon',
      slug: 'monstera',
      position: '0',
      parent: '',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain(
      'Le slug « monstera » est déjà pris par une autre catégorie.',
    )
  })

  it('crée une catégorie et un produit, visibles aussitôt dans l’API', async () => {
    const created = await post('/admin/categories/nouvelle', {
      name: 'Cactus',
      slug: 'cactus',
      position: '9',
      parent: 'plantes-interieur',
    })
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/admin/categories?ok=categorie-creee')
    expect(await (await page('/admin/categories?ok=categorie-creee')).text()).toContain(
      'Catégorie créée.',
    )

    const product = await postProductWithPhoto('/admin/produits/nouveau', {
      name: 'Cactus cierge',
      slug: 'cactus-cierge',
      categorySlug: 'cactus',
      price: '12,50',
      exposure: 'soleil',
      size: 'S',
      inStock: 'on',
      featured: 'on',
      description: 'Rustique.\r\n\r\nRésiste au vent.',
    })
    expect(product.status).toBe(303)
    expect(await apiJson('/api/products/cactus-cierge')).toHaveProperty(
      'description',
      'Rustique.\n\nRésiste au vent.',
    )
    expect(JSON.stringify(await apiJson('/api/featured-products'))).toContain(
      '"slug":"cactus-cierge"',
    )

    expect(slugsOf(await apiJson('/api/categories'))).toContain('cactus')
    const branch = await apiJson('/api/products?category=cactus')
    expect(JSON.stringify(branch)).toContain('"slug":"cactus-cierge"')
    expect(JSON.stringify(branch)).toContain('"price":1250')
    expect(JSON.stringify(branch)).toContain('"alt":"Cactus cierge"')
    expect(JSON.stringify(branch)).not.toContain('"id":24,')
  })

  it('renomme une catégorie : ses produits suivent, trouvés sous le nouveau slug', async () => {
    const renamed = await post('/admin/categories/cactus/modifier', {
      name: 'Cactées',
      slug: 'cactees',
      position: '9',
      parent: 'plantes-interieur',
    })
    expect(renamed.status).toBe(303)

    expect(JSON.stringify(await apiJson('/api/products?category=cactees'))).toContain(
      '"slug":"cactus-cierge"',
    )
    expect(
      JSON.stringify(await apiJson('/api/products?category=plantes-interieur&itemsPerPage=48')),
    ).toContain('"slug":"cactus-cierge"')
  })

  it('refuse de supprimer une catégorie qui a des produits, puis la supprime une fois vide', async () => {
    const refused = await post('/admin/categories/cactees/supprimer', {})
    expect(refused.status).toBe(422)
    expect(await refused.text()).toContain('« Cactées » contient 1 produit(s)')

    const id = /"id":(\d+),"slug":"cactus-cierge"/.exec(
      JSON.stringify(await apiJson('/api/products?category=cactees')),
    )?.[1]
    expect(id).toBeDefined()
    expect((await page(`/admin/produits/${id ?? ''}/supprimer`)).status).toBe(200)
    expect((await post(`/admin/produits/${id ?? ''}/supprimer`, {})).status).toBe(303)
    expect((await post('/admin/categories/cactees/supprimer', {})).status).toBe(303)
    expect(slugsOf(await apiJson('/api/categories'))).not.toContain('cactees')
  })
})

describe('Admin : attributs', () => {
  const productId = async (slug: string): Promise<string> =>
    /"id":(\d+),"slug":"([^"]+)"/g.exec(
      JSON.stringify(await apiJson(`/api/products/${slug}`)),
    )?.[1] ?? ''

  it('liste les attributs et propose un champ par attribut dans le formulaire du produit', async () => {
    const list = await (await page('/admin/attributs')).text()
    expect(list).toContain('Feuillage')
    expect(list).toContain('Persistant, Caduc')

    const form = await (
      await page(`/admin/produits/${await productId('palmier-nain')}/modifier`)
    ).text()
    expect(form).toContain('<label for="attributes[hauteur-adulte]">Hauteur adulte (cm)</label>')
    expect(form).toMatch(
      /name="attributes\[hauteur-adulte\]"\s+type="number"\s+step="any"\s+value="250"/,
    )
    expect(form).toContain('Non renseigné')
  })

  it('refuse de retirer une valeur portée par des produits', async () => {
    const response = await post('/admin/attributs/feuillage/modifier', {
      label: 'Feuillage',
      type: 'choice',
      filterable: 'on',
      position: '1',
      'choices[0][value]': '',
      'choices[0][label]': '',
      'choices[1][value]': 'caduc',
      'choices[1][label]': 'Caduc',
    })

    expect(response.status).toBe(422)
    expect(await response.text()).toContain('La valeur « Persistant » est utilisée par 6 produits.')
  })

  it('refuse un code déjà pris et un formulaire mal rempli', async () => {
    const taken = await post('/admin/attributs/nouveau', {
      code: 'feuillage',
      label: 'Doublon',
      type: 'text',
      position: '9',
    })
    expect(taken.status).toBe(422)
    expect(await taken.text()).toContain(
      'Le code « feuillage » est déjà pris par un autre attribut.',
    )

    const invalid = await post('/admin/attributs/nouveau', {
      code: '1-code',
      label: '',
      type: 'date',
      position: '-1',
      'choices[0][value]': '-x',
      'choices[0][label]': 'X',
    })
    const body = await invalid.text()
    expect(invalid.status).toBe(422)
    expect(body).toContain(
      'Minuscules, chiffres et tirets, 40 caractères au plus, commence par une lettre.',
    )
    expect(body).toContain('Cette valeur ne doit pas être vide.')
    expect(body).toContain('Le choix sélectionné n&#39;est pas valide.')
    expect(body).toContain('Cette valeur doit être positive ou nulle.')
    expect(body).toContain(
      'Minuscules, chiffres et tirets, 40 caractères au plus, sans tiret au début.',
    )
  })

  it('crée puis modifie un attribut ; le code ne change plus', async () => {
    const created = await post('/admin/attributs/nouveau', {
      code: 'port',
      label: 'Port',
      type: 'choice',
      filterable: 'on',
      position: '3',
      'choices[0][value]': 'buissonnant',
      'choices[0][label]': 'Buissonnant',
      'choices[1][value]': '',
      'choices[1][label]': '',
    })
    expect(created.status).toBe(303)
    expect(created.headers.get('location')).toBe('/admin/attributs?ok=attribut-cree')

    const edit = await (await page('/admin/attributs/port/modifier')).text()
    expect(edit).toMatch(/name="code"\s+type="text"\s+value="port"[^>]*disabled/)
    expect(edit).toContain('name="choices[3][value]"')

    const edited = await post('/admin/attributs/port/modifier', {
      code: 'autre',
      label: 'Port de la plante',
      type: 'choice',
      filterable: 'on',
      position: '3',
      'choices[0][value]': 'buissonnant',
      'choices[0][label]': 'Buissonnant',
      'choices[1][value]': 'retombant',
      'choices[1][label]': 'Retombant',
    })
    expect(edited.status).toBe(303)
    expect(await (await page('/admin/produits/nouveau')).text()).toContain(
      '<label for="attributes[port]">Port de la plante</label>',
    )
  })

  it('enregistre les attributs d’un produit, refuse une valeur invalide, retire ceux d’un attribut supprimé', async () => {
    const id = await productId('palmier-nain')
    const fields = {
      name: 'Palmier nain',
      slug: 'palmier-nain',
      categorySlug: 'palmiers',
      price: '44,90',
      exposure: 'soleil',
      size: 'M',
      inStock: 'on',
      description: '',
    }

    const refused = await post(`/admin/produits/${id}/modifier`, {
      ...fields,
      'attributes[hauteur-adulte]': '-',
    })
    expect(refused.status).toBe(422)
    expect(await refused.text()).toContain('L&#39;attribut « Hauteur adulte » attend un nombre.')

    const saved = await post(`/admin/produits/${id}/modifier`, {
      ...fields,
      'attributes[feuillage]': 'persistant',
      'attributes[hauteur-adulte]': '12.5',
      'attributes[port]': 'retombant',
    })
    expect(saved.status).toBe(303)
    const codes = () =>
      apiJson('/api/products/palmier-nain').then((product) =>
        JSON.stringify(product)
          .match(/"code":"[^"]+","label":"[^"]+","type":"[a-z]+","value":"[^"]+"/g)
          ?.map((entry) => entry.replace(/"label":"[^"]+","type":"[a-z]+",/, '')),
      )
    expect(await codes()).toEqual([
      '"code":"feuillage","value":"persistant"',
      '"code":"hauteur-adulte","value":"12.5"',
      '"code":"port","value":"retombant"',
    ])

    expect((await page('/admin/attributs/port/supprimer')).status).toBe(200)
    expect((await post('/admin/attributs/port/supprimer', {})).status).toBe(303)
    expect(await codes()).toEqual([
      '"code":"feuillage","value":"persistant"',
      '"code":"hauteur-adulte","value":"12.5"',
    ])
    expect((await post('/admin/attributs/port/supprimer', {})).status).toBe(422)
    expect((await page('/admin/attributs/port/modifier')).status).toBe(404)
  })
})
