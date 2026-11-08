import { html } from 'hono/html'

import {
  checkbox,
  checkboxField,
  field,
  integer,
  maxLength,
  textField,
} from '#/shared/http/adminForms.ts'

import { MAX_GALLERY_IMAGES } from '#/catalog/domain/catalog.ts'
import { fileContent, imageFileHtml } from '#/media/http/adminImageFields.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

/**
 * Galerie d'un produit dans son formulaire (ADR 0008), comme GalleryImageType de l'API Platform :
 * une ligne par image enregistrée (aperçu, texte de remplacement, position, remplacement du fichier,
 * case « Retirer cette image ») et deux lignes d'ajout, sans JavaScript. L'empreinte de l'image
 * d'une ligne voyage dans un champ caché ; le cas d'usage ne retient que celles de la galerie actuelle.
 */
const EMPTY_GALLERY_ROWS = 2
const MAX_ALT_LENGTH = 255

type Part = 'key' | 'content' | 'alt' | 'position' | 'remove'

/** Nom d'un champ de ligne : `gallery[0][alt]`. */
const galleryKey = (index: number, part: Part): string => `gallery[${index}][${part}]`

const GALLERY_KEY = /^gallery\[(\d+)\]\[(?:key|content|alt|position|remove)\]$/

/** Indices des lignes parmi les clés d'un formulaire (envoyé ou à afficher), croissants. */
const rowIndices = (fields: object): number[] =>
  [
    ...new Set(
      Object.keys(fields).flatMap((key) => {
        const index = GALLERY_KEY.exec(key)?.[1]
        return index === undefined ? [] : [Number(index)]
      }),
    ),
  ].sort((a, b) => a - b)

/** Lignes des images enregistrées, positions 1, 2, 3… */
export const galleryValues = (gallery: readonly Media.Image[]): Values =>
  Object.fromEntries(
    gallery.flatMap(({ key, alt }, index) => [
      [galleryKey(index, 'key'), key],
      [galleryKey(index, 'alt'), alt],
      [galleryKey(index, 'position'), String(index + 1)],
      [galleryKey(index, 'remove'), ''],
    ]),
  )

/** Deux lignes d'ajout sous les lignes existantes, à la suite des positions. */
export const withEmptyGalleryRows = (values: Values): Values => {
  const start = rowIndices(values).length
  const rows: Values = {}
  for (let index = start; index < start + EMPTY_GALLERY_ROWS; index++) {
    rows[galleryKey(index, 'key')] = ''
    rows[galleryKey(index, 'alt')] = ''
    rows[galleryKey(index, 'position')] = String(index + 1)
  }
  return { ...values, ...rows }
}

/** Lit les lignes envoyées, renumérotées à partir de 0 ; position vide : 0, comme l'API Platform. */
export const readGalleryRows = async (
  body: Record<string, unknown>,
  values: Values,
  errors: Errors,
): Promise<Catalog.GalleryRowInput[]> => {
  const rows: Catalog.GalleryRowInput[] = []
  for (const [index, sent] of rowIndices(body).entries()) {
    const key = field(body, galleryKey(sent, 'key'))
    const alt = field(body, galleryKey(sent, 'alt'))
    const positionText = field(body, galleryKey(sent, 'position'))
    const remove = checkbox(body, galleryKey(sent, 'remove'))
    values[galleryKey(index, 'key')] = key
    values[galleryKey(index, 'alt')] = alt
    values[galleryKey(index, 'position')] = positionText
    values[galleryKey(index, 'remove')] = remove
    maxLength(errors, galleryKey(index, 'alt'), alt, MAX_ALT_LENGTH)
    const position = positionText === '' ? 0 : integer(positionText)
    if (position === null) {
      errors[galleryKey(index, 'position')] = 'Cette valeur doit être un nombre entier.'
    } else if (position < 0) {
      errors[galleryKey(index, 'position')] = 'Cette valeur doit être positive ou nulle.'
    }
    rows.push({
      key: key === '' ? null : key,
      content: await fileContent(body, galleryKey(sent, 'content')),
      alt,
      position: position ?? 0,
      remove: remove === 'on',
    })
  }
  return rows
}

/** Lignes de la galerie ; `gallery` : images enregistrées, pour les aperçus. */
export const galleryFieldsHtml = (
  values: Values,
  errors: Errors,
  gallery: readonly Media.Image[],
) =>
  html`<fieldset>
    <legend>Galerie</legend>
    <p>
      ${MAX_GALLERY_IMAGES} images au plus, en plus de l'image principale, par position croissante.
      Enregistrer propose de nouvelles lignes d'ajout.
    </p>
    ${rowIndices(values).map((index) => {
      const current = gallery.find(({ key }) => key === values[galleryKey(index, 'key')]) ?? null
      return html`<fieldset data-galerie>
        ${current === null ? html`<legend>Nouvelle image</legend>` : html`<legend>Image ${index + 1}</legend>`}
        <input
          type="hidden"
          name="${galleryKey(index, 'key')}"
          value="${current === null ? '' : current.key}"
        />
        ${imageFileHtml('product', galleryKey(index, 'content'), 'Fichier', current)}
        ${textField('Texte de remplacement', galleryKey(index, 'alt'), values, errors)}
        <p>Vide : le nom du produit.</p>
        ${textField('Position', galleryKey(index, 'position'), values, errors, 'number')}
        ${current === null ? '' : checkboxField('Retirer cette image', galleryKey(index, 'remove'), values)}
      </fieldset>`
    })}
  </fieldset>`
