import { describe, expect, it } from 'vitest'

import { CatalogRuleViolation } from '#/catalog/domain/catalogRules.ts'
import { Price } from '#/catalog/domain/price.ts'
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  updateCategory,
  updateProduct,
} from '#/catalog/application/adminCatalog.ts'
import { centsToEuros, euroCents } from '#/catalog/http/adminCatalogForms.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

type Stored = Catalog.Product & { categoryPath: string[] }

/** Catalogue en mémoire : deux niveaux sous « plantes », un produit dans « monstera ». */
const catalogue = () => {
  let categories: Catalog.Category[] = [
    { slug: 'plantes', name: 'Plantes', parent: null, position: 1 },
    { slug: 'feuillages', name: 'Feuillages', parent: 'plantes', position: 1 },
    { slug: 'monstera', name: 'Monstera', parent: 'feuillages', position: 1 },
    { slug: 'jardin', name: 'Jardin', parent: null, position: 2 },
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
      image: 1,
    },
  ]
  const strip = ({ categoryPath, ...product }: Stored): Catalog.Product => product
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
    },
    productWriter: {
      findById: (id: number) =>
        Promise.resolve(products.map(strip).find((p) => p.id === id) ?? null),
      findBySlug: (slug: string) =>
        Promise.resolve(products.map(strip).find((p) => p.slug === slug) ?? null),
      findAll: () => Promise.resolve(products.map(strip)),
      countInCategory: (slug: string) =>
        Promise.resolve(products.filter((p) => p.categorySlug === slug).length),
      create: (input: Catalog.ProductInput, path: readonly string[]) => {
        const product = { id: products.length + 1, ...input, categoryPath: [...path] }
        products = [...products, product]
        return Promise.resolve(strip(product))
      },
      update: (id: number, input: Catalog.ProductInput, path: readonly string[]) => {
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
    },
  }

  return { dependencies, categories: () => categories, products: () => products }
}

const category = (slug: string, parent: string | null): Catalog.Category => ({
  slug,
  name: slug,
  parent,
  position: 0,
})

const product = (slug: string, categorySlug: string, image = 1): Catalog.ProductInput => ({
  slug,
  name: slug,
  categorySlug,
  price: Price.fromCents(1990),
  exposure: 'soleil',
  size: 'S',
  inStock: true,
  image,
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
    [product('nouveau', 'monstera', 13), 'Le visuel est un numéro de 1 à 12 : 13.'],
  ])('refuse une création qui enfreint une règle', async (input, message) => {
    await expect(createProduct(catalogue().dependencies, input)).rejects.toThrow(message)
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
