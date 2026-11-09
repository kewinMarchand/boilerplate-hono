import { describe, expect, it } from 'vitest'

import { translated } from '#/shared/domain/translations.ts'

import { CatalogRuleViolation } from '#/catalog/domain/catalogRules.ts'
import { Price } from '#/catalog/domain/price.ts'
import {
  createCategory,
  createProduct,
  createProductAttribute,
  deleteCategory,
  deleteProduct,
  deleteProductAttribute,
  updateCategory,
  updateProduct,
  updateProductAttribute,
} from '#/catalog/application/adminCatalog.ts'
import { centsToEuros, euroCents } from '#/catalog/http/adminCatalogForms.ts'

import { fakeMedia, PHOTO, photo, testImage } from './fakeMedia.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

type Stored = Catalog.Product & { categoryPath: string[] }

/** Catalogue en mémoire : deux niveaux sous « plantes », un produit dans « monstera ». */
const catalogue = () => {
  let categories: Catalog.Category[] = [
    { slug: 'plantes', name: 'Plantes', parent: null, position: 1, translations: {} },
    { slug: 'feuillages', name: 'Feuillages', parent: 'plantes', position: 1, translations: {} },
    { slug: 'monstera', name: 'Monstera', parent: 'feuillages', position: 1, translations: {} },
    { slug: 'jardin', name: 'Jardin', parent: null, position: 2, translations: {} },
  ]
  let products: Stored[] = [
    {
      id: 1,
      slug: 'monstera-deliciosa',
      name: 'Monstera deliciosa',
      categorySlug: 'monstera',
      categoryPath: ['plantes', 'feuillages', 'monstera'],
      price: Price.fromCents(3490),
      exposure: 'mi-ombre',
      size: 'M',
      inStock: true,
      featured: false,
      description: '',
      image: testImage('Monstera deliciosa'),
      attributeValues: { feuillage: 'persistant', hauteur: '250' },
      gallery: [],
      metaTitle: '',
      metaDescription: '',
      translations: {},
    },
  ]
  let attributes: Catalog.ProductAttribute[] = [
    {
      code: 'feuillage',
      label: 'Feuillage',
      type: 'choice',
      unit: null,
      filterable: true,
      position: 1,
      choices: [
        { value: 'persistant', label: 'Persistant' },
        { value: 'caduc', label: 'Caduc' },
      ],
      translations: {},
    },
    {
      code: 'hauteur-adulte',
      label: 'Hauteur adulte',
      type: 'number',
      unit: 'cm',
      filterable: false,
      position: 2,
      choices: [],
      translations: {},
    },
    {
      code: 'origine',
      label: 'Origine',
      type: 'text',
      unit: null,
      filterable: false,
      position: 3,
      choices: [],
      translations: {},
    },
  ]
  const strip = ({ categoryPath, ...product }: Stored): Catalog.Product => product
  const media = fakeMedia()
  const dependencies = {
    categories: { findAll: () => Promise.resolve(categories) },
    categoryWriter: {
      create: (category: Catalog.Category) => {
        categories = [...categories, category]
        return Promise.resolve()
      },
      update: (previous: string, category: Catalog.Category) => {
        categories = categories.map((c) => {
          if (c.slug === previous) return category
          return c.parent === previous ? { ...c, parent: category.slug } : c
        })
        return Promise.resolve()
      },
      remove: (slug: string) => {
        categories = categories.filter((c) => c.slug !== slug)
        return Promise.resolve()
      },
      replaceAll: (all: readonly Catalog.Category[]) => {
        categories = [...all]
        return Promise.resolve()
      },
    },
    productWriter: {
      findById: (id: number) =>
        Promise.resolve(products.map(strip).find((p) => p.id === id) ?? null),
      findBySlug: (slug: string, locale?: string | null) =>
        Promise.resolve(
          products
            .map(strip)
            .find((p) => translated(p.translations, 'slug', p.slug, locale ?? null) === slug) ??
            null,
        ),
      findAll: () => Promise.resolve(products.map(strip)),
      countInCategory: (slug: string) =>
        Promise.resolve(products.filter((p) => p.categorySlug === slug).length),
      create: (input: Catalog.ProductSaved, path: readonly string[]) => {
        const product = { id: products.length + 1, ...input, categoryPath: [...path] }
        products = [...products, product]
        return Promise.resolve(strip(product))
      },
      update: (id: number, input: Catalog.ProductSaved, path: readonly string[]) => {
        products = products.map((p) =>
          p.id === id ? { id, ...input, categoryPath: [...path] } : p,
        )
        return Promise.resolve()
      },
      remove: (id: number) => {
        products = products.filter((p) => p.id !== id)
        return Promise.resolve()
      },
      moveCategory: (previous: string, slug: string, path: readonly string[]) => {
        products = products.map((p) =>
          p.categorySlug === previous ? { ...p, categorySlug: slug, categoryPath: [...path] } : p,
        )
        return Promise.resolve()
      },
      removeAttributeValue: (code: string) => {
        products = products.map(({ attributeValues: { [code]: _, ...kept }, ...p }) => ({
          ...p,
          attributeValues: kept,
        }))
        return Promise.resolve()
      },
      replaceAll: (
        all: readonly {
          readonly product: Catalog.Product
          readonly categoryPath: readonly string[]
        }[],
      ) => {
        products = all.map(({ product, categoryPath }) => ({
          ...product,
          categoryPath: [...categoryPath],
        }))
        return Promise.resolve()
      },
    },
    attributes: { findAll: () => Promise.resolve(attributes) },
    attributeWriter: {
      findByCode: (code: string) =>
        Promise.resolve(attributes.find((attribute) => attribute.code === code) ?? null),
      create: (attribute: Catalog.ProductAttribute) => {
        attributes = [...attributes, attribute]
        return Promise.resolve()
      },
      update: (attribute: Catalog.ProductAttribute) => {
        attributes = attributes.map((a) => (a.code === attribute.code ? attribute : a))
        return Promise.resolve()
      },
      remove: (code: string) => {
        attributes = attributes.filter((a) => a.code !== code)
        return Promise.resolve()
      },
    },
    media: media.media,
  }

  return {
    dependencies,
    files: media.files,
    categories: () => categories,
    products: () => products,
    attributes: () => attributes,
  }
}

const category = (slug: string, parent: string | null): Catalog.Category => ({
  slug,
  name: slug,
  parent,
  position: 0,
  translations: {},
})

const product = (
  slug: string,
  categorySlug: string,
  imageContent: Uint8Array | null = PHOTO,
): Catalog.ProductInput => ({
  slug,
  name: slug,
  categorySlug,
  price: Price.fromCents(1990),
  exposure: 'soleil',
  size: 'S',
  inStock: true,
  featured: false,
  description: '',
  imageContent,
  imageAlt: '',
  imageDecorative: false,
  attributeValues: {},
  gallery: [],
  metaTitle: '',
  metaDescription: '',
})

const galleryRow = (
  content: string | null,
  position: number,
  fields: Partial<Catalog.GalleryRowInput> = {},
): Catalog.GalleryRowInput => ({
  key: null,
  content: content === null ? null : photo(content),
  alt: '',
  position,
  remove: false,
  ...fields,
})

describe('catégories', () => {
  it('crée une catégorie sous un parent existant', async () => {
    const { dependencies, categories } = catalogue()

    await createCategory(dependencies, category('fougeres', 'feuillages'))

    expect(categories().map((c) => c.slug)).toContain('fougeres')
  })

  it.each([
    [category('jardin', null), 'Le slug « jardin » est déjà pris par une autre catégorie.'],
    [category('nouvelle', 'inconnue'), "La catégorie parente n'existe plus."],
    [
      category('trop-bas', 'monstera'),
      'Le catalogue a 3 niveaux au plus : cette place en donnerait 4.',
    ],
  ])('refuse une création qui enfreint une règle', async (input, message) => {
    await expect(createCategory(catalogue().dependencies, input)).rejects.toThrow(
      new CatalogRuleViolation(message),
    )
  })

  it('refuse de ranger une catégorie sous une de ses sous-catégories', async () => {
    await expect(
      updateCategory(catalogue().dependencies, 'plantes', { ...category('plantes', 'monstera') }),
    ).rejects.toThrow(
      'Une catégorie ne peut pas être rangée sous elle-même ou sous une de ses sous-catégories.',
    )
  })

  it('compte le sous-arbre qui descend avec la catégorie déplacée', async () => {
    // feuillages a un niveau sous elle : sous jardin (niveau 1), elle irait au 2 et monstera au 3
    await expect(
      updateCategory(catalogue().dependencies, 'feuillages', {
        ...category('feuillages', 'jardin'),
      }),
    ).resolves.toBeUndefined()
    await expect(
      updateCategory(catalogue().dependencies, 'plantes', { ...category('plantes', 'jardin') }),
    ).rejects.toThrow('Le catalogue a 3 niveaux au plus : cette place en donnerait 4.')
  })

  it('déplace les produits de toute la branche quand le slug et le parent changent', async () => {
    const { dependencies, products, categories } = catalogue()

    await updateCategory(dependencies, 'feuillages', {
      slug: 'plantes-vertes',
      name: 'Plantes vertes',
      parent: 'jardin',
      position: 3,
    })

    expect(categories().find((c) => c.slug === 'monstera')?.parent).toBe('plantes-vertes')
    expect(products()[0]?.categoryPath).toEqual(['jardin', 'plantes-vertes', 'monstera'])
  })

  it('refuse de supprimer une catégorie qui a des sous-catégories ou des produits', async () => {
    const { dependencies } = catalogue()

    await expect(deleteCategory(dependencies, 'feuillages')).rejects.toThrow(
      "« Feuillages » contient des sous-catégories : les déplacer ou les supprimer d'abord.",
    )
    await expect(deleteCategory(dependencies, 'monstera')).rejects.toThrow(
      "« Monstera » contient 1 produit(s) : les déplacer ou les supprimer d'abord.",
    )
    await expect(deleteCategory(dependencies, 'jardin')).resolves.toBeUndefined()
    await expect(deleteCategory(dependencies, 'jardin')).rejects.toThrow(
      "Cette catégorie n'existe plus.",
    )
  })
})

describe('produits', () => {
  it('crée un produit avec le chemin de sa catégorie', async () => {
    const { dependencies, products } = catalogue()

    await createProduct(dependencies, product('fougere', 'feuillages'))

    expect(products().at(-1)?.categoryPath).toEqual(['plantes', 'feuillages'])
  })

  it.each([
    [
      product('monstera-deliciosa', 'monstera'),
      'Le slug « monstera-deliciosa » est déjà pris par un autre produit.',
    ],
    [product('nouveau', 'inconnue'), "La catégorie du produit n'existe pas."],
    [product('nouveau', 'monstera', null), "Un produit a besoin d'une image."],
  ])('refuse une création qui enfreint une règle', async (input, message) => {
    await expect(createProduct(catalogue().dependencies, input)).rejects.toThrow(message)
  })

  it('sans texte de remplacement, un produit prend son nom ; sans fichier, il garde son image', async () => {
    const { dependencies, products } = catalogue()

    const created = await createProduct(dependencies, product('fougere', 'feuillages'))
    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      imageAlt: 'Feuille découpée',
    })

    expect(created.image?.alt).toBe('fougere')
    expect(products()[0]?.image).toEqual({ key: 'a'.repeat(32), alt: 'Feuille découpée' })
  })

  it('garde son propre slug à la modification, refuse un produit disparu', async () => {
    const { dependencies } = catalogue()

    await expect(
      updateProduct(dependencies, 1, product('monstera-deliciosa', 'monstera')),
    ).resolves.toBeUndefined()
    await expect(updateProduct(dependencies, 99, product('x', 'monstera'))).rejects.toThrow(
      "Ce produit n'existe plus.",
    )
    await expect(deleteProduct(dependencies, 99)).rejects.toThrow("Ce produit n'existe plus.")
  })

  it('enregistre le référencement sans blancs de début ni de fin', async () => {
    const { dependencies, products } = catalogue()

    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      metaTitle: ' Monstera en pot ',
      metaDescription: 'Rustique, compact.',
    })

    expect([products()[0]?.metaTitle, products()[0]?.metaDescription]).toEqual([
      'Monstera en pot',
      'Rustique, compact.',
    ])
  })
})

describe('galerie d’un produit', () => {
  it('ajoute les images par position, au nom du produit sans texte, sans agrandir une source étroite', async () => {
    const { dependencies, products, files } = catalogue()

    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      name: 'Monstera',
      gallery: [
        galleryRow('image/jpeg 600x600', 2),
        galleryRow('image/jpeg 1600x1600', 1, { alt: 'Vue de près' }),
        galleryRow(null, 3),
      ],
    })

    const gallery = products()[0]?.gallery ?? []
    expect(gallery.map(({ alt, width }) => [alt, width])).toEqual([
      ['Vue de près', undefined],
      ['Monstera', 600],
    ])
    expect(files.has(`${gallery[1]?.key}-600.webp`)).toBe(true)
  })

  it('retire une image et renomme une autre', async () => {
    const { dependencies, products } = catalogue()
    const a = testImage('A', 'a'.repeat(32))
    const b = testImage('B', 'b'.repeat(32))
    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      gallery: [galleryRow('image/jpeg 800x800', 1)],
    })
    const [stored] = products()[0]?.gallery ?? []

    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      gallery: [
        galleryRow(null, 1, { key: stored?.key ?? null, remove: true }),
        galleryRow('image/jpeg 800x800', 2, { alt: 'B, revue' }),
        galleryRow(null, 3, { key: a.key }),
        galleryRow(null, 4, { key: b.key }),
      ],
    })

    // Une empreinte que la galerie actuelle ne porte pas vaut une ligne d'ajout vide
    expect(products()[0]?.gallery.map(({ alt }) => alt)).toEqual(['B, revue'])
  })

  it('refuse plus de 8 images avant tout encodage', async () => {
    const { dependencies, files } = catalogue()

    await expect(
      createProduct(dependencies, {
        ...product('palmier', 'jardin'),
        gallery: Array.from({ length: 9 }, (_, index) =>
          galleryRow('image/jpeg 1600x1600', index + 1),
        ),
      }),
    ).rejects.toThrow(new CatalogRuleViolation('La galerie compte 8 images au plus (9 demandées).'))
    expect(files.size).toBe(0)
  })
})

describe('valeurs d’attributs d’un produit', () => {
  it('enregistre les attributs renseignés, sans espaces, et ignore les codes inconnus', async () => {
    const { dependencies, products } = catalogue()

    await updateProduct(dependencies, 1, {
      ...product('monstera-deliciosa', 'monstera', null),
      attributeValues: { feuillage: 'persistant', 'hauteur-adulte': ' 250 ', origine: '', x: 'y' },
    })

    expect(products()[0]?.attributeValues).toEqual({
      feuillage: 'persistant',
      'hauteur-adulte': '250',
    })
  })

  it('vide un attribut laissé vide', async () => {
    const { dependencies, products } = catalogue()

    await updateProduct(dependencies, 1, product('monstera-deliciosa', 'monstera', null))

    expect(products()[0]?.attributeValues).toEqual({})
  })

  it.each([
    [{ feuillage: 'epineux' }, "« epineux » n'est pas une valeur de l'attribut « Feuillage »."],
    [{ 'hauteur-adulte': 'deux mètres' }, "L'attribut « Hauteur adulte » attend un nombre."],
    [{ origine: 'a'.repeat(121) }, "L'attribut « Origine » a 120 caractères au plus."],
  ])('refuse une valeur que sa définition rejette', async (attributeValues, message) => {
    await expect(
      createProduct(catalogue().dependencies, {
        ...product('nouveau', 'monstera'),
        attributeValues,
      }),
    ).rejects.toThrow(new CatalogRuleViolation(message))
  })
})

const attributeInput = (
  code: string,
  type: Catalog.AttributeType,
  choices: Record<string, string> = {},
): Catalog.ProductAttributeInput => ({
  code,
  label: code.charAt(0).toUpperCase() + code.slice(1),
  type,
  unit: '',
  filterable: type === 'choice',
  position: 0,
  choices: Object.entries(choices).map(([value, label]) => ({ value, label })),
})

describe('attributs', () => {
  it('crée un attribut et écarte les lignes vides', async () => {
    const { dependencies, attributes } = catalogue()

    await createProductAttribute(
      dependencies,
      attributeInput('port', 'choice', { buissonnant: 'Buissonnant', '': '' }),
    )

    expect(attributes().at(-1)).toEqual({
      code: 'port',
      label: 'Port',
      type: 'choice',
      unit: null,
      filterable: true,
      position: 0,
      choices: [{ value: 'buissonnant', label: 'Buissonnant' }],
      translations: {},
    })
  })

  it('refuse un code déjà pris et une ligne à moitié remplie', async () => {
    await expect(
      createProductAttribute(catalogue().dependencies, attributeInput('feuillage', 'choice')),
    ).rejects.toThrow(
      new CatalogRuleViolation('Le code « feuillage » est déjà pris par un autre attribut.'),
    )
    await expect(
      createProductAttribute(catalogue().dependencies, {
        ...attributeInput('port', 'choice'),
        choices: [{ value: 'buissonnant', label: '' }],
      }),
    ).rejects.toThrow(new CatalogRuleViolation('Chaque valeur a un code et un libellé.'))
  })

  it('modifie un attribut et garde son code', async () => {
    const { dependencies, attributes } = catalogue()

    await updateProductAttribute(dependencies, 'feuillage', {
      ...attributeInput('autre-code', 'choice', {
        persistant: 'Toujours vert',
        'semi-persistant': 'Semi-persistant',
      }),
      label: 'Type de feuillage',
    })

    expect(attributes()[0]).toMatchObject({
      code: 'feuillage',
      label: 'Type de feuillage',
      choices: [
        { value: 'persistant', label: 'Toujours vert' },
        { value: 'semi-persistant', label: 'Semi-persistant' },
      ],
    })
  })

  it('refuse de retirer une valeur ou de changer le type quand un produit les porte', async () => {
    await expect(
      updateProductAttribute(
        catalogue().dependencies,
        'feuillage',
        attributeInput('feuillage', 'choice', { caduc: 'Caduc' }),
      ),
    ).rejects.toThrow(
      new CatalogRuleViolation('La valeur « Persistant » est utilisée par 1 produit.'),
    )
    await expect(
      updateProductAttribute(catalogue().dependencies, 'feuillage', attributeInput('x', 'text')),
    ).rejects.toThrow(
      new CatalogRuleViolation(
        'Le type de « Feuillage » ne peut plus changer : il est renseigné sur 1 produit.',
      ),
    )
    await expect(
      updateProductAttribute(catalogue().dependencies, 'inconnu', attributeInput('x', 'text')),
    ).rejects.toThrow(new CatalogRuleViolation("Cet attribut n'existe plus."))
  })

  it('supprimer un attribut retire sa valeur des produits', async () => {
    const { dependencies, attributes, products } = catalogue()

    await deleteProductAttribute(dependencies, 'feuillage')

    expect(attributes().map(({ code }) => code)).toEqual(['hauteur-adulte', 'origine'])
    expect(products()[0]?.attributeValues).toEqual({ hauteur: '250' })
  })
})

describe('prix saisis en euros', () => {
  it.each([
    ['34,90', 3490],
    ['34.9', 3490],
    ['35', 3500],
    ['0,05', 5],
    ['-2', -200],
  ])('%s vaut %d centimes', (saisie, centimes) => {
    expect(euroCents(saisie)).toBe(centimes)
  })

  it('refuse ce qui n’est pas un montant, et affiche les centimes en euros', () => {
    expect(euroCents('douze')).toBeNull()
    expect(euroCents('3,456')).toBeNull()
    expect(centsToEuros(3490)).toBe('34,90')
    expect(centsToEuros(5)).toBe('0,05')
  })
})
