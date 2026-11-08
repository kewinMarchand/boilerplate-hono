import { Hono } from 'hono'

import { notFoundPage } from '#/shared/http/adminLayout.ts'

import { CatalogRuleViolation } from '#/catalog/domain/catalogRules.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { InvalidPriceError } from '#/catalog/domain/price.ts'
import { MediaRuleViolation } from '#/media/domain/imageRules.ts'
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

import { attributeValues, readAttributeForm, withEmptyRows } from './adminAttributeForms.ts'
import { attributeFormPage, attributesPage } from './adminAttributePages.ts'
import { readCategoryForm, readProductForm } from './adminCatalogForms.ts'
import {
  categoriesPage,
  categoryFormPage,
  categoryValues,
  confirmDeletePage,
  productFormPage,
  productsPage,
  productValues,
} from './adminCatalogPages.ts'

import type { CatalogAdminDependencies } from '#/catalog/application/adminCatalog.ts'

/** Messages de réussite, choisis par le paramètre `ok` après la redirection (jamais de texte libre dans l'adresse). */
const DONE: Record<string, string> = {
  'categorie-creee': 'Catégorie créée.',
  'categorie-modifiee': 'Catégorie modifiée.',
  'categorie-supprimee': 'Catégorie supprimée.',
  'produit-cree': 'Produit créé.',
  'produit-modifie': 'Produit modifié.',
  'produit-supprime': 'Produit supprimé.',
  'attribut-cree': 'Attribut créé.',
  'attribut-modifie': 'Attribut modifié.',
  'attribut-supprime': 'Attribut supprimé.',
}

/** Règle refusée : son message, à montrer dans la page ; toute autre erreur remonte (500). */
const refusal = (error: unknown): string => {
  if (
    error instanceof CatalogRuleViolation ||
    error instanceof InvalidPriceError ||
    error instanceof MediaRuleViolation
  ) {
    return error.message
  }
  throw error
}

const productId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

/**
 * Pages de l'admin du catalogue (ADR 0001), montées par l'admin derrière sa session : catégories,
 * produits et attributs (ADR 0006). La forme est vérifiée par les formulaires, les règles par les cas d'usage.
 */
export const adminCatalogRoutes = (dependencies: CatalogAdminDependencies) => {
  const app = new Hono()
  const tree = async () => CategoryTree.of(await dependencies.categories.findAll())
  const attributes = () => dependencies.attributes.findAll()
  const done = (key: string | undefined) => (key === undefined ? undefined : DONE[key])

  app.get('/admin/categories', async (c) =>
    c.html(categoriesPage(await tree(), done(c.req.query('ok')))),
  )

  app.get('/admin/categories/nouvelle', async (c) =>
    c.html(
      categoryFormPage('Nouvelle catégorie', '/admin/categories/nouvelle', await tree(), {
        position: '0',
        parent: '',
      }),
    ),
  )

  app.post('/admin/categories/nouvelle', async (c) => {
    const form = readCategoryForm(await c.req.parseBody())
    const action = '/admin/categories/nouvelle'
    if (form.data === null) {
      return c.html(
        categoryFormPage('Nouvelle catégorie', action, await tree(), form.values, form.errors),
        422,
      )
    }
    try {
      await createCategory(dependencies, form.data)
    } catch (error) {
      return c.html(
        categoryFormPage(
          'Nouvelle catégorie',
          action,
          await tree(),
          form.values,
          {},
          refusal(error),
        ),
        422,
      )
    }
    return c.redirect('/admin/categories?ok=categorie-creee', 303)
  })

  app.get('/admin/categories/:slug/modifier', async (c) => {
    const current = await tree()
    const category = current.categories.find((candidate) => candidate.slug === c.req.param('slug'))
    if (category === undefined) {
      return c.html(notFoundPage(), 404)
    }
    const title = `Modifier « ${category.name} »`
    return c.html(categoryFormPage(title, c.req.path, current, categoryValues(category)))
  })

  app.post('/admin/categories/:slug/modifier', async (c) => {
    const slug = c.req.param('slug')
    const form = readCategoryForm(await c.req.parseBody())
    const title = 'Modifier la catégorie'
    if (form.data === null) {
      return c.html(
        categoryFormPage(title, c.req.path, await tree(), form.values, form.errors),
        422,
      )
    }
    try {
      await updateCategory(dependencies, slug, form.data)
    } catch (error) {
      return c.html(
        categoryFormPage(title, c.req.path, await tree(), form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/categories?ok=categorie-modifiee', 303)
  })

  app.get('/admin/categories/:slug/supprimer', async (c) => {
    const category = (await tree()).categories.find(
      (candidate) => candidate.slug === c.req.param('slug'),
    )
    if (category === undefined) {
      return c.html(notFoundPage(), 404)
    }
    return c.html(
      confirmDeletePage(
        `Supprimer « ${category.name} »`,
        '/admin/categories',
        `La catégorie « ${category.name} » sera supprimée. Elle doit être vide : ni sous-catégorie, ni produit.`,
        c.req.path,
        '/admin/categories',
      ),
    )
  })

  app.post('/admin/categories/:slug/supprimer', async (c) => {
    try {
      await deleteCategory(dependencies, c.req.param('slug'))
    } catch (error) {
      return c.html(categoriesPage(await tree(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/categories?ok=categorie-supprimee', 303)
  })

  app.get('/admin/produits', async (c) =>
    c.html(
      productsPage(
        await dependencies.productWriter.findAll(),
        await tree(),
        done(c.req.query('ok')),
      ),
    ),
  )

  app.get('/admin/produits/nouveau', async (c) =>
    c.html(
      productFormPage(
        'Nouveau produit',
        '/admin/produits/nouveau',
        await tree(),
        await attributes(),
        {
          exposure: 'soleil',
          size: 'M',
          inStock: 'on',
        },
      ),
    ),
  )

  app.post('/admin/produits/nouveau', async (c) => {
    const form = await readProductForm(await c.req.parseBody())
    const action = '/admin/produits/nouveau'
    if (form.data === null) {
      return c.html(
        productFormPage(
          'Nouveau produit',
          action,
          await tree(),
          await attributes(),
          form.values,
          form.errors,
        ),
        422,
      )
    }
    try {
      await createProduct(dependencies, form.data)
    } catch (error) {
      return c.html(
        productFormPage(
          'Nouveau produit',
          action,
          await tree(),
          await attributes(),
          form.values,
          {},
          refusal(error),
        ),
        422,
      )
    }
    return c.redirect('/admin/produits?ok=produit-cree', 303)
  })

  app.get('/admin/produits/:id/modifier', async (c) => {
    const id = productId(c.req.param('id'))
    const product = id === null ? null : await dependencies.productWriter.findById(id)
    if (product === null) {
      return c.html(notFoundPage(), 404)
    }
    return c.html(
      productFormPage(
        `Modifier « ${product.name} »`,
        c.req.path,
        await tree(),
        await attributes(),
        productValues(product),
        {},
        undefined,
        product.image,
      ),
    )
  })

  app.post('/admin/produits/:id/modifier', async (c) => {
    const id = productId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const form = await readProductForm(await c.req.parseBody())
    const title = 'Modifier le produit'
    const image = async () => (await dependencies.productWriter.findById(id))?.image ?? null
    if (form.data === null) {
      return c.html(
        productFormPage(
          title,
          c.req.path,
          await tree(),
          await attributes(),
          form.values,
          form.errors,
          undefined,
          await image(),
        ),
        422,
      )
    }
    try {
      await updateProduct(dependencies, id, form.data)
    } catch (error) {
      return c.html(
        productFormPage(
          title,
          c.req.path,
          await tree(),
          await attributes(),
          form.values,
          {},
          refusal(error),
          await image(),
        ),
        422,
      )
    }
    return c.redirect('/admin/produits?ok=produit-modifie', 303)
  })

  app.get('/admin/produits/:id/supprimer', async (c) => {
    const id = productId(c.req.param('id'))
    const product = id === null ? null : await dependencies.productWriter.findById(id)
    if (product === null) {
      return c.html(notFoundPage(), 404)
    }
    return c.html(
      confirmDeletePage(
        `Supprimer « ${product.name} »`,
        '/admin/produits',
        `Le produit « ${product.name} » sera supprimé du catalogue.`,
        c.req.path,
        '/admin/produits',
      ),
    )
  })

  app.post('/admin/produits/:id/supprimer', async (c) => {
    const id = productId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    try {
      await deleteProduct(dependencies, id)
    } catch (error) {
      const products = await dependencies.productWriter.findAll()
      return c.html(productsPage(products, await tree(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/produits?ok=produit-supprime', 303)
  })

  app.get('/admin/attributs', async (c) =>
    c.html(attributesPage(await attributes(), done(c.req.query('ok')))),
  )

  app.get('/admin/attributs/nouveau', (c) =>
    c.html(
      attributeFormPage(
        'Nouvel attribut',
        '/admin/attributs/nouveau',
        withEmptyRows({ type: 'choice', position: '0' }),
      ),
    ),
  )

  app.post('/admin/attributs/nouveau', async (c) => {
    const form = readAttributeForm(await c.req.parseBody(), null)
    const action = '/admin/attributs/nouveau'
    if (form.data === null) {
      return c.html(attributeFormPage('Nouvel attribut', action, form.values, form.errors), 422)
    }
    try {
      await createProductAttribute(dependencies, form.data)
    } catch (error) {
      return c.html(
        attributeFormPage('Nouvel attribut', action, form.values, {}, refusal(error)),
        422,
      )
    }
    return c.redirect('/admin/attributs?ok=attribut-cree', 303)
  })

  app.get('/admin/attributs/:code/modifier', async (c) => {
    const attribute = await dependencies.attributeWriter.findByCode(c.req.param('code'))
    if (attribute === null) {
      return c.html(notFoundPage(), 404)
    }
    return c.html(
      attributeFormPage(
        `Modifier « ${attribute.label} »`,
        c.req.path,
        attributeValues(attribute),
        {},
        undefined,
        true,
      ),
    )
  })

  app.post('/admin/attributs/:code/modifier', async (c) => {
    const code = c.req.param('code')
    const form = readAttributeForm(await c.req.parseBody(), code)
    const title = "Modifier l'attribut"
    if (form.data === null) {
      return c.html(
        attributeFormPage(title, c.req.path, form.values, form.errors, undefined, true),
        422,
      )
    }
    try {
      await updateProductAttribute(dependencies, code, form.data)
    } catch (error) {
      return c.html(
        attributeFormPage(title, c.req.path, form.values, {}, refusal(error), true),
        422,
      )
    }
    return c.redirect('/admin/attributs?ok=attribut-modifie', 303)
  })

  app.get('/admin/attributs/:code/supprimer', async (c) => {
    const attribute = await dependencies.attributeWriter.findByCode(c.req.param('code'))
    if (attribute === null) {
      return c.html(notFoundPage(), 404)
    }
    return c.html(
      confirmDeletePage(
        `Supprimer « ${attribute.label} »`,
        '/admin/attributs',
        `L'attribut « ${attribute.label} » sera supprimé et retiré des produits qui le renseignent.`,
        c.req.path,
        '/admin/attributs',
      ),
    )
  })

  app.post('/admin/attributs/:code/supprimer', async (c) => {
    try {
      await deleteProductAttribute(dependencies, c.req.param('code'))
    } catch (error) {
      return c.html(attributesPage(await attributes(), undefined, refusal(error)), 422)
    }
    return c.redirect('/admin/attributs?ok=attribut-supprime', 303)
  })

  return app
}
