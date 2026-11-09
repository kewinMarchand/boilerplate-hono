import { Hono } from 'hono'

import { refusalMessage, t } from '#/shared/http/adminI18n.ts'
import { notFoundPage } from '#/shared/http/adminLayout.ts'

import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
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
import { withEmptyGalleryRows } from './adminGalleryFields.ts'

import type { CatalogAdminDependencies } from '#/catalog/application/adminCatalog.ts'
import type { MessageKey } from '#/shared/http/adminI18n.ts'

/** Messages de réussite, choisis par le paramètre `ok` après la redirection (jamais de texte libre dans l'adresse). */
const DONE: Readonly<Record<string, MessageKey>> = {
  'categorie-creee': 'flash.category_created',
  'categorie-modifiee': 'flash.category_updated',
  'categorie-supprimee': 'flash.category_deleted',
  'produit-cree': 'flash.product_created',
  'produit-modifie': 'flash.product_updated',
  'produit-supprime': 'flash.product_deleted',
  'attribut-cree': 'flash.attribute_created',
  'attribut-modifie': 'flash.attribute_updated',
  'attribut-supprime': 'flash.attribute_deleted',
}

const refusal = refusalMessage

const productId = (value: string): number | null => (/^\d+$/.test(value) ? Number(value) : null)

/**
 * Pages de l'admin du catalogue (ADR 0001), montées par l'admin derrière sa session : catégories,
 * produits et attributs (ADR 0006). La forme est vérifiée par les formulaires, les règles par les cas d'usage.
 */
export const adminCatalogRoutes = (dependencies: CatalogAdminDependencies) => {
  const app = new Hono()
  const tree = async () => CategoryTree.of(await dependencies.categories.findAll())
  const attributes = () => dependencies.attributes.findAll()
  const done = (key: string | undefined) => {
    const message = key === undefined ? undefined : DONE[key]
    return message === undefined ? undefined : t(message)
  }

  app.get('/admin/categories', async (c) =>
    c.html(categoriesPage(await tree(), done(c.req.query('ok')))),
  )

  app.get('/admin/categories/nouvelle', async (c) =>
    c.html(
      categoryFormPage(t('title.new_category'), '/admin/categories/nouvelle', await tree(), {
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
        categoryFormPage(t('title.new_category'), action, await tree(), form.values, form.errors),
        422,
      )
    }
    try {
      await createCategory(dependencies, form.data)
    } catch (error) {
      return c.html(
        categoryFormPage(
          t('title.new_category'),
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
    const title = t('title.edit', { name: category.name })
    return c.html(categoryFormPage(title, c.req.path, current, categoryValues(category)))
  })

  app.post('/admin/categories/:slug/modifier', async (c) => {
    const slug = c.req.param('slug')
    const form = readCategoryForm(await c.req.parseBody())
    const title = t('title.edit_category')
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
        t('title.delete', { name: category.name }),
        '/admin/categories',
        t('confirm.delete_category', { name: category.name }),
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
        t('title.new_product'),
        '/admin/produits/nouveau',
        await tree(),
        await attributes(),
        withEmptyGalleryRows({
          exposure: 'soleil',
          size: 'M',
          inStock: 'on',
        }),
      ),
    ),
  )

  app.post('/admin/produits/nouveau', async (c) => {
    const form = await readProductForm(await c.req.parseBody())
    const action = '/admin/produits/nouveau'
    if (form.data === null) {
      return c.html(
        productFormPage(
          t('title.new_product'),
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
          t('title.new_product'),
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
        t('title.edit', { name: product.name }),
        c.req.path,
        await tree(),
        await attributes(),
        productValues(product),
        {},
        undefined,
        product.image,
        product.gallery,
      ),
    )
  })

  app.post('/admin/produits/:id/modifier', async (c) => {
    const id = productId(c.req.param('id'))
    if (id === null) {
      return c.html(notFoundPage(), 404)
    }
    const form = await readProductForm(await c.req.parseBody())
    const title = t('title.edit_product')
    const current = () => dependencies.productWriter.findById(id)
    if (form.data === null) {
      const product = await current()
      return c.html(
        productFormPage(
          title,
          c.req.path,
          await tree(),
          await attributes(),
          form.values,
          form.errors,
          undefined,
          product?.image ?? null,
          product?.gallery ?? [],
        ),
        422,
      )
    }
    try {
      await updateProduct(dependencies, id, form.data)
    } catch (error) {
      const product = await current()
      return c.html(
        productFormPage(
          title,
          c.req.path,
          await tree(),
          await attributes(),
          form.values,
          {},
          refusal(error),
          product?.image ?? null,
          product?.gallery ?? [],
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
        t('title.delete', { name: product.name }),
        '/admin/produits',
        t('confirm.delete_product', { name: product.name }),
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
        t('title.new_attribute'),
        '/admin/attributs/nouveau',
        withEmptyRows({ type: 'choice', position: '0' }),
      ),
    ),
  )

  app.post('/admin/attributs/nouveau', async (c) => {
    const form = readAttributeForm(await c.req.parseBody(), null)
    const action = '/admin/attributs/nouveau'
    if (form.data === null) {
      return c.html(
        attributeFormPage(t('title.new_attribute'), action, form.values, form.errors),
        422,
      )
    }
    try {
      await createProductAttribute(dependencies, form.data)
    } catch (error) {
      return c.html(
        attributeFormPage(t('title.new_attribute'), action, form.values, {}, refusal(error)),
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
        t('title.edit', { name: attribute.label }),
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
    const title = t('title.edit_attribute')
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
        t('title.delete', { name: attribute.label }),
        '/admin/attributs',
        t('confirm.delete_attribute', { name: attribute.label }),
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
