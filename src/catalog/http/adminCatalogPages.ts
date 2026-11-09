import { html } from 'hono/html'

import { metaFieldsHtml, selectField, textareaField, textField } from '#/shared/http/adminForms.ts'
import { t } from '#/shared/http/adminI18n.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'
import { inLocale, languageTabs, translationValues } from '#/shared/http/adminTranslations.ts'

import { EXPOSURES, SIZES } from '#/catalog/domain/catalog.ts'
import { MAX_DEPTH } from '#/catalog/domain/catalogRules.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import {
  imageCell,
  imageFieldsHtml,
  imagePreviewScript,
  imageValues,
} from '#/media/http/adminImageFields.ts'

import { CATEGORY_TRANSLATED, centsToEuros, PRODUCT_TRANSLATED } from './adminCatalogForms.ts'
import {
  galleryAltField,
  galleryFieldsHtml,
  galleryValues,
  withEmptyGalleryRows,
} from './adminGalleryFields.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

/** Nom précédé d'un tiret par niveau : l'arbre se lit dans une liste ou un menu déroulant. */
const indented = (tree: CategoryTree, category: Catalog.Category): string =>
  `${'— '.repeat(CategoryTree.pathTo(tree, category.slug).length - 1)}${category.name}`

/** Catégories dans l'ordre de l'arbre : chaque parent suivi de ses sous-catégories. */
const inTreeOrder = (
  tree: CategoryTree,
  parent: Catalog.Category | null = null,
): Catalog.Category[] =>
  CategoryTree.childrenOf(tree, parent).flatMap((category) => [
    category,
    ...inTreeOrder(tree, category),
  ])

/** Liens Modifier et Supprimer d'une ligne, nommés pour les lecteurs d'écran. */
export const rowActions = (path: string, name: string) =>
  html`<a href="${path}/modifier">${t('action.edit')}<span class="sr"> ${name}</span></a>
    ·
    <a href="${path}/supprimer">${t('action.delete')}<span class="sr"> ${name}</span></a>`

export const categoriesPage = (tree: CategoryTree, message?: string, error?: string) =>
  adminPage(
    t('entity.categories'),
    '/admin/categories',
    html`<h1>${t('entity.categories')}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/categories/nouvelle">${t('title.new_category')}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.name')}</th>
            <th scope="col">${t('field.slug')}</th>
            <th scope="col">${t('field.position')}</th>
            <th scope="col">${t('field.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${inTreeOrder(tree).map(
            (category) =>
              html`<tr>
                <td>${indented(tree, category)}</td>
                <td><code>${category.slug}</code></td>
                <td>${category.position}</td>
                <td>${rowActions(`/admin/categories/${category.slug}`, category.name)}</td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )

export const categoryFormPage = (
  title: string,
  action: string,
  tree: CategoryTree,
  values: Values,
  errors: Errors = {},
  error?: string,
) => {
  // Parents possibles : les catégories des niveaux au-dessus du dernier (une catégorie y serait au plus au niveau 3)
  const parents = inTreeOrder(tree)
    .filter((category) => CategoryTree.pathTo(tree, category.slug).length < MAX_DEPTH)
    .map((category) => [category.slug, indented(tree, category)] as const)

  return adminPage(
    title,
    '/admin/categories',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" novalidate>
        ${languageTabs(
          'categorie',
          CATEGORY_TRANSLATED,
          errors,
          (locale) =>
            html`${textField(t('field.name'), inLocale(locale, 'name'), values, errors)}
            ${textField(t('field.slug'), inLocale(locale, 'slug'), values, errors)}
            ${locale === null ? '' : html`<p>${t('help.translated_slug')}</p>`}`,
        )}
        <p>${t('help.category_slug')}</p>
        ${textField(t('field.position'), 'position', values, errors, 'number')}
        ${selectField(
          t('field.parent'),
          'parent',
          [['', t('category.no_parent')], ...parents],
          values,
          errors,
        )}
        <button type="submit">${t('form.save')}</button>
      </form>
      <p><a href="/admin/categories">${t('category.back')}</a></p>`,
  )
}

export const confirmDeletePage = (
  title: string,
  current: string,
  question: string,
  action: string,
  back: string,
) =>
  adminPage(
    title,
    current,
    html`<h1>${title}</h1>
      <p>${question}</p>
      <form method="post" action="${action}">
        <button type="submit" class="danger">${t('action.delete')}</button>
      </form>
      <p><a href="${back}">${t('form.cancel')}</a></p>`,
  )

export const productsPage = (
  products: readonly Catalog.Product[],
  tree: CategoryTree,
  message?: string,
  error?: string,
) => {
  const names = new Map(tree.categories.map((category) => [category.slug, category.name]))

  return adminPage(
    t('entity.products'),
    '/admin/produits',
    html`<h1>${t('entity.products')}</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/produits/nouveau">${t('title.new_product')}</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">${t('field.image')}</th>
            <th scope="col">${t('field.name')}</th>
            <th scope="col">${t('field.category')}</th>
            <th scope="col">${t('field.price')}</th>
            <th scope="col">${t('field.stock')}</th>
            <th scope="col">${t('field.featured')}</th>
            <th scope="col">${t('field.actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(
            (product) =>
              html`<tr>
                ${imageCell(product.image, 'product')}
                <td>${product.name}</td>
                <td>${names.get(product.categorySlug) ?? product.categorySlug}</td>
                <td>${centsToEuros(product.price)} €</td>
                <td>${product.inStock ? t('field.in_stock') : t('product.sold_out')}</td>
                <td>${product.featured ? t('common.yes') : t('common.no')}</td>
                <td>${rowActions(`/admin/produits/${product.id}`, product.name)}</td>
              </tr>`,
          )}
        </tbody>
      </table>`,
  )
}

/** Nom du champ d'un attribut dans le formulaire du produit : `attributes[feuillage]`. */
export const attributeFieldName = (code: string): string => `attributes[${code}]`

/** Un champ facultatif par attribut défini dans la section « Attributs ». */
const attributeFields = (
  attributes: readonly Catalog.ProductAttribute[],
  values: Values,
  errors: Errors,
) => {
  if (attributes.length === 0) {
    return ''
  }
  const fields = attributes.map(({ code, label, type, unit, choices }) => {
    const name = attributeFieldName(code)
    const text = unit === null ? label : `${label} (${unit})`
    if (type === 'choice') {
      return selectField(
        text,
        name,
        [
          ['', t('product.attribute_unset')],
          ...choices.map((choice) => [choice.value, choice.label] as const),
        ],
        values,
        errors,
      )
    }
    return type === 'number'
      ? html`<label for="${name}">${text}</label>
          <input
            id="${name}"
            name="${name}"
            type="number"
            step="any"
            value="${values[name] ?? ''}"
          />`
      : textField(text, name, values, errors)
  })

  return html`<fieldset>
    <legend>${t('field.attributes')}</legend>
    ${fields}
  </fieldset>`
}

export const productFormPage = (
  title: string,
  action: string,
  tree: CategoryTree,
  attributes: readonly Catalog.ProductAttribute[],
  values: Values,
  errors: Errors = {},
  error?: string,
  image: Media.Image | null = null,
  gallery: readonly Media.Image[] = [],
) =>
  adminPage(
    title,
    '/admin/produits',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" enctype="multipart/form-data" novalidate>
        ${languageTabs('produit', PRODUCT_TRANSLATED, errors, (locale) =>
          productTexts(locale, values, errors),
        )}
        ${selectField(
          t('field.category'),
          'categorySlug',
          [
            ['', t('product.choose_category')],
            ...inTreeOrder(tree).map(
              (category) => [category.slug, indented(tree, category)] as const,
            ),
          ],
          values,
          errors,
        )}
        ${textField(t('field.price_euros'), 'price', values, errors)}
        ${selectField(
          t('field.exposure'),
          'exposure',
          EXPOSURES.map((value) => [value, t(`exposure.${value}`)] as const),
          values,
          errors,
        )}
        ${selectField(
          t('field.size'),
          'size',
          SIZES.map((value) => [value, value] as const),
          values,
          errors,
        )}
        <label for="inStock">
          <input
            id="inStock"
            name="inStock"
            type="checkbox"
            ${values.inStock === 'on' ? 'checked' : ''}
          />${t('field.in_stock')}
        </label>
        <label for="featured">
          <input
            id="featured"
            name="featured"
            type="checkbox"
            aria-describedby="aide-featured"
            ${values.featured === 'on' ? 'checked' : ''}
          />${t('field.featured')}
        </label>
        <p id="aide-featured">${t('help.featured')}</p>
        ${imageFieldsHtml('product', t('help.product_alt'), values, errors, image)}
        ${galleryFieldsHtml(values, errors, gallery)} ${attributeFields(attributes, values, errors)}
        <button type="submit">${t('form.save')}</button>
      </form>
      ${imagePreviewScript}
      <p><a href="/admin/produits">${t('product.back')}</a></p>`,
  )

/**
 * Textes traduisibles d'un produit, dans une langue (null : la langue par défaut, avec son
 * référencement ; le texte de remplacement de l'image de la langue par défaut reste avec l'image).
 */
const productTexts = (locale: string | null, values: Values, errors: Errors) =>
  html`${textField(t('field.name'), inLocale(locale, 'name'), values, errors)}
    ${textField(t('field.slug'), inLocale(locale, 'slug'), values, errors)}
    ${locale === null ? '' : html`<p>${t('help.translated_slug')}</p>`}
    ${textareaField(t('field.description'), inLocale(locale, 'description'), values, errors, 6)}
    <p>${t('help.product_description')}</p>
    ${locale === null ? '' : textField(t('field.alt'), inLocale(locale, 'imageAlt'), values, errors)}
    ${metaFieldsHtml(values, errors, inLocale(locale, 'metaTitle'), inLocale(locale, 'metaDescription'))}`

/** Valeurs du formulaire d'une catégorie ou d'un produit existants. */
export const categoryValues = (category: Catalog.Category): Values => ({
  name: category.name,
  slug: category.slug,
  position: String(category.position),
  parent: category.parent ?? '',
  ...translationValues(category.translations, CATEGORY_TRANSLATED),
})

export const productValues = (product: Catalog.Product): Values => ({
  name: product.name,
  slug: product.slug,
  categorySlug: product.categorySlug,
  price: centsToEuros(product.price),
  exposure: product.exposure,
  size: product.size,
  inStock: product.inStock ? 'on' : '',
  featured: product.featured ? 'on' : '',
  description: product.description,
  ...imageValues(product.image),
  ...withEmptyGalleryRows(galleryValues(product.gallery)),
  metaTitle: product.metaTitle,
  metaDescription: product.metaDescription,
  ...translationValues(product.translations, [
    ...PRODUCT_TRANSLATED,
    ...product.gallery.map(({ key }) => galleryAltField(key)),
  ]),
  ...Object.fromEntries(
    Object.entries(product.attributeValues).map(([code, value]) => [
      attributeFieldName(code),
      value,
    ]),
  ),
})
