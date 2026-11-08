import { createHash } from 'node:crypto'
import { html, raw } from 'hono/html'

import { field, textField } from '#/shared/http/adminForms.ts'

import { fileName, largestWidth, ratioOf, widthsOf } from '#/media/domain/imageRules.ts'

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

/**
 * Aperçu d'une image : sa plus petite variante WebP, servie par mediaRoutes sur le même hôte que
 * l'admin, d'où une adresse relative (comme ImagePreview de l'API Platform).
 */
const previewUrl = (image: Media.Image, usage: Media.Usage): string =>
  `/media/${fileName(image.key, widthsOf(usage)[0], 'webp')}`

/** Cellule « Image » des listes : la plus petite variante, ou un tiret sans image. */
export const imageCell = (image: Media.Image | null, usage: Media.Usage) =>
  html`<td>
    ${
      image === null
        ? '—'
        : html`<img
            src="${previewUrl(image, usage)}"
            alt=""
            width="64"
            loading="lazy"
            class="vignette"
          />`
    }
  </td>`

/** Montre le fichier choisi à la place de l'image actuelle, avant l'envoi du formulaire. */
const PREVIEW_SCRIPT = `
  const input = document.getElementById('imageContent');
  const preview = document.getElementById('apercu-image');
  input.addEventListener('change', () => {
    const [file] = input.files;
    if (!file) return;
    preview.querySelector('img').src = URL.createObjectURL(file);
    preview.querySelector('figcaption').textContent = 'Image choisie, enregistrée à l’envoi du formulaire';
    preview.hidden = false;
  });
`

/** Empreinte du script d'aperçu, seul script autorisé par la CSP de l'admin. */
export const PREVIEW_SCRIPT_HASH = `'sha256-${createHash('sha256').update(PREVIEW_SCRIPT).digest('base64')}'`

const helpText = (usage: Media.Usage): string => {
  const ratio = ratioOf(usage)
  return ratio === null
    ? `PNG, WebP ou AVIF (transparence gardée) ou JPEG, 10 Mo au plus, sans recadrage, ${largestWidth(usage)} px de large au moins. Pas de SVG. Sans fichier, l'image actuelle est gardée.`
    : `JPEG, PNG, WebP ou AVIF, 10 Mo au plus, recadrée au centre au format ${ratio[0]}:${ratio[1]}, ${largestWidth(usage)} px de large au moins. Sans fichier, l'image actuelle est gardée.`
}

/**
 * Champs d'image d'un formulaire. `current` : l'image enregistrée, montrée au-dessus du champ de
 * fichier. `decorative` à false : pas de case « décorative » (logo, dont le texte vaut le nom du site).
 */
export const imageFieldsHtml = (
  usage: Media.Usage,
  altHelp: string,
  values: Values,
  errors: Errors,
  current: Media.Image | null = null,
  { label = 'Image', decorative = true }: { label?: string; decorative?: boolean } = {},
) =>
  html`<figure id="apercu-image" ${current === null ? 'hidden' : ''}>
      <img
        ${current === null ? '' : html`src="${previewUrl(current, usage)}"`}
        alt=""
        class="apercu"
      />
      <figcaption>Image actuelle</figcaption>
    </figure>
    <label for="imageContent">${label}</label>
    <input
      id="imageContent"
      name="imageContent"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      aria-describedby="aide-imageContent"
    />
    <p id="aide-imageContent">${helpText(usage)}</p>
    ${textField('Texte de remplacement', 'imageAlt', values, errors)}
    <p>${altHelp}</p>
    ${
      decorative
        ? html`<label for="imageDecorative">
            <input
              id="imageDecorative"
              name="imageDecorative"
              type="checkbox"
              ${values.imageDecorative === 'on' ? 'checked' : ''}
            />Image décorative (aucun texte de remplacement)
          </label>`
        : ''
    }
    ${raw(`<script>${PREVIEW_SCRIPT}</script>`)}`
