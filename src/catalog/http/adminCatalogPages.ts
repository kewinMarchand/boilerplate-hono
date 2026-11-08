import { html } from 'hono/html'

import { selectField, textareaField, textField } from '#/shared/http/adminForms.ts'
import { adminPage, flash, formError } from '#/shared/http/adminLayout.ts'

import { EXPOSURES, SIZES } from '#/catalog/domain/catalog.ts'
import { MAX_DEPTH } from '#/catalog/domain/catalogRules.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { imageCell, imageFieldsHtml, imageValues } from '#/media/http/adminImageFields.ts'

import { centsToEuros } from './adminCatalogForms.ts'

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

export const categoriesPage = (tree: CategoryTree, message?: string, error?: string) =>
  adminPage(
    'Catégories',
    '/admin/categories',
    html`<h1>Catégories</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/categories/nouvelle">Nouvelle catégorie</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Nom</th>
            <th scope="col">Slug</th>
            <th scope="col">Position</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${inTreeOrder(tree).map(
            (category) =>
              html`<tr>
                <td>${indented(tree, category)}</td>
                <td><code>${category.slug}</code></td>
                <td>${category.position}</td>
                <td>
                  <a href="/admin/categories/${category.slug}/modifier"
                    >Modifier<span class="sr"> ${category.name}</span></a
                  >
                  ·
                  <a href="/admin/categories/${category.slug}/supprimer"
                    >Supprimer<span class="sr"> ${category.name}</span></a
                  >
                </td>
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
        ${textField('Nom', 'name', values, errors)} ${textField('Slug', 'slug', values, errors)}
        ${textField('Position', 'position', values, errors, 'number')}
        ${selectField('Parent', 'parent', [['', 'Aucun (catégorie racine)'], ...parents], values, errors)}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/categories">Retour aux catégories</a></p>`,
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
        <button type="submit" class="danger">Supprimer</button>
      </form>
      <p><a href="${back}">Annuler</a></p>`,
  )

export const productsPage = (
  products: readonly Catalog.Product[],
  tree: CategoryTree,
  message?: string,
  error?: string,
) => {
  const names = new Map(tree.categories.map((category) => [category.slug, category.name]))

  return adminPage(
    'Produits',
    '/admin/produits',
    html`<h1>Produits</h1>
      ${flash(message)} ${formError(error)}
      <p><a href="/admin/produits/nouveau">Nouveau produit</a></p>
      <table>
        <thead>
          <tr>
            <th scope="col">Image</th>
            <th scope="col">Nom</th>
            <th scope="col">Catégorie</th>
            <th scope="col">Prix</th>
            <th scope="col">Stock</th>
            <th scope="col">À la une</th>
            <th scope="col">Actions</th>
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
                <td>${product.inStock ? 'En stock' : 'Épuisé'}</td>
                <td>${product.featured ? 'Oui' : 'Non'}</td>
                <td>
                  <a href="/admin/produits/${product.id}/modifier"
                    >Modifier<span class="sr"> ${product.name}</span></a
                  >
                  ·
                  <a href="/admin/produits/${product.id}/supprimer"
                    >Supprimer<span class="sr"> ${product.name}</span></a
                  >
                </td>
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
        [['', 'Non renseigné'], ...choices.map((choice) => [choice.value, choice.label] as const)],
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
    <legend>Attributs</legend>
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
) =>
  adminPage(
    title,
    '/admin/produits',
    html`<h1>${title}</h1>
      ${formError(error)}
      <form method="post" action="${action}" enctype="multipart/form-data" novalidate>
        ${textField('Nom', 'name', values, errors)} ${textField('Slug', 'slug', values, errors)}
        ${selectField(
          'Catégorie',
          'categorySlug',
          [
            ['', 'Choisir une catégorie'],
            ...inTreeOrder(tree).map(
              (category) => [category.slug, indented(tree, category)] as const,
            ),
          ],
          values,
          errors,
        )}
        ${textField('Prix (€)', 'price', values, errors)}
        ${textareaField('Description (texte brut, une ligne vide sépare deux paragraphes)', 'description', values, errors, 6)}
        ${selectField(
          'Exposition',
          'exposure',
          EXPOSURES.map((value) => [value, value] as const),
          values,
          errors,
        )}
        ${selectField(
          'Taille',
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
          />En stock
        </label>
        <label for="featured">
          <input
            id="featured"
            name="featured"
            type="checkbox"
            aria-describedby="aide-featured"
            ${values.featured === 'on' ? 'checked' : ''}
          />À la une
        </label>
        <p id="aide-featured">
          Montré dans le carrousel de la page d'accueil, par ordre alphabétique.
        </p>
        ${imageFieldsHtml('product', 'Vide : le nom du produit, qui suffit le plus souvent.', values, errors, image)}
        ${attributeFields(attributes, values, errors)}
        <button type="submit">Enregistrer</button>
      </form>
      <p><a href="/admin/produits">Retour aux produits</a></p>`,
  )

/** Valeurs du formulaire d'une catégorie ou d'un produit existants. */
export const categoryValues = (category: Catalog.Category): Values => ({
  name: category.name,
  slug: category.slug,
  position: String(category.position),
  parent: category.parent ?? '',
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
  ...Object.fromEntries(
    Object.entries(product.attributeValues).map(([code, value]) => [
      attributeFieldName(code),
      value,
    ]),
  ),
})
