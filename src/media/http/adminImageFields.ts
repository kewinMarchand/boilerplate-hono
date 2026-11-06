import { html } from 'hono/html'

import { field, textField } from '#/shared/http/adminForms.ts'

import { largestWidth, ratioOf } from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

const MAX_ALT_LENGTH = 255

/** Champs d'image envoyés : le fichier (null pour garder l'image actuelle), le texte et la case « décorative ». */
export interface ImageFields {
  readonly content: Uint8Array | null
  readonly alt: string
  readonly decorative: boolean
}

/**
 * Lit les champs d'image d'un formulaire multipart de l'admin (ADR 0002). Les règles (type, poids,
 * dimensions, texte de remplacement) sont vérifiées ensuite par storeImage, comme dans l'API Platform.
 */
export const readImageFields = async (
  body: Record<string, unknown>,
  values: Values,
  errors: Errors,
): Promise<ImageFields> => {
  const file = body['imageContent']
  const alt = field(body, 'imageAlt')
  const decorative = field(body, 'imageDecorative') !== ''
  values.imageAlt = alt
  values.imageDecorative = decorative ? 'on' : ''
  if (Array.from(alt).length > MAX_ALT_LENGTH) {
    errors.imageAlt = `Cette chaîne est trop longue. Elle doit avoir au maximum ${MAX_ALT_LENGTH} caractères.`
  }
  const content =
    file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null

  return { content, alt, decorative }
}

/** Valeurs du formulaire pour l'image actuelle d'un objet. */
export const imageValues = (image: Media.Image | null): Values => ({
  imageAlt: image?.alt ?? '',
  imageDecorative: image !== null && image.alt === '' ? 'on' : '',
})

export const imageFieldsHtml = (
  usage: Media.Usage,
  altHelp: string,
  values: Values,
  errors: Errors,
) => {
  const [ratioWidth, ratioHeight] = ratioOf(usage)

  return html`<label for="imageContent">Image</label>
    <input
      id="imageContent"
      name="imageContent"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      aria-describedby="aide-imageContent"
    />
    <p id="aide-imageContent">
      JPEG, PNG, WebP ou AVIF, 10 Mo au plus, recadrée au centre au format
      ${ratioWidth}:${ratioHeight}, ${largestWidth(usage)} px de large au moins. Sans fichier,
      l'image actuelle est gardée.
    </p>
    ${textField('Texte de remplacement', 'imageAlt', values, errors)}
    <p>${altHelp}</p>
    <label for="imageDecorative">
      <input
        id="imageDecorative"
        name="imageDecorative"
        type="checkbox"
        ${values.imageDecorative === 'on' ? 'checked' : ''}
      />Image décorative (aucun texte de remplacement)
    </label>`
}
