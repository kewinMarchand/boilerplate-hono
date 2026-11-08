import { createHash } from 'node:crypto'
import { html, raw } from 'hono/html'

import { checkboxField, field, maxLength, textField } from '#/shared/http/adminForms.ts'

import { audioFileName } from '#/media/domain/audioRules.ts'
import {
  fallbackFormatOf,
  fileName,
  largestWidth,
  minimumWidth,
  ratioOf,
  widthsOf,
} from '#/media/domain/imageRules.ts'

import type { Media } from '#/media/domain/Media.ts'
import type { Errors, Values } from '#/shared/http/adminForms.ts'

const MAX_ALT_LENGTH = 255

/** Champs d'image envoyés : le fichier (null pour garder l'image actuelle), le texte et la case « décorative ». */
export interface ImageFields {
  readonly content: Uint8Array | null
  readonly alt: string
  readonly decorative: boolean
}

/** Contenu d'un champ de fichier envoyé, null sans fichier. */
export const fileContent = async (
  body: Record<string, unknown>,
  name: string,
): Promise<Uint8Array | null> => {
  const file = body[name]
  return file instanceof File && file.size > 0 ? new Uint8Array(await file.arrayBuffer()) : null
}

/**
 * Lit les champs d'image d'un formulaire multipart de l'admin (ADR 0002). Les règles (type, poids,
 * dimensions, texte de remplacement) sont vérifiées ensuite par storeImage, comme dans l'API Platform.
 * Le préfixe nomme les champs (`{prefix}Content`, `{prefix}Alt`, `{prefix}Decorative`) quand un
 * formulaire porte plusieurs images, comme ImageFields de l'API Platform.
 */
export const readImageFields = async (
  body: Record<string, unknown>,
  values: Values,
  errors: Errors,
  prefix = 'image',
): Promise<ImageFields> => {
  const alt = field(body, `${prefix}Alt`)
  const decorative = field(body, `${prefix}Decorative`) !== ''
  values[`${prefix}Alt`] = alt
  values[`${prefix}Decorative`] = decorative ? 'on' : ''
  maxLength(errors, `${prefix}Alt`, alt, MAX_ALT_LENGTH)

  return { content: await fileContent(body, `${prefix}Content`), alt, decorative }
}

/** Valeurs du formulaire pour l'image actuelle d'un objet. */
export const imageValues = (image: Media.Image | null, prefix = 'image'): Values => ({
  [`${prefix}Alt`]: image?.alt ?? '',
  [`${prefix}Decorative`]: image !== null && image.alt === '' ? 'on' : '',
})

/**
 * Aperçu d'une image : sa plus petite variante WebP (la variante 192 en PNG pour une icône, dont la
 * plus petite ne se voit pas), servie par mediaRoutes sur le même hôte que l'admin, d'où une adresse
 * relative (comme ImagePreview de l'API Platform).
 */
const previewUrl = (image: Media.Image, usage: Media.Usage): string =>
  `/media/${fileName(image.key, usage === 'icon' ? 192 : widthsOf(usage)[0], fallbackFormatOf(usage))}`

/** Légende de l'aperçu : l'image actuelle et son texte de remplacement. */
const previewCaption = (image: Media.Image, usage: Media.Usage, label: string): string => {
  if (usage === 'icon') {
    return label
  }
  return image.alt === ''
    ? `${label}, décorative (sans texte de remplacement)`
    : `${label}, texte de remplacement : « ${image.alt} »`
}

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
  document.querySelectorAll('[data-apercu]').forEach((preview) => {
    const input = document.getElementById(preview.dataset.apercu);
    if (!input) return;
    input.addEventListener('change', () => {
      const [file] = input.files;
      if (!file) return;
      preview.querySelector('img').src = URL.createObjectURL(file);
      preview.querySelector('figcaption').textContent = 'Image choisie, enregistrée à l’envoi du formulaire';
      preview.hidden = false;
    });
  });
`

/** Empreinte du script d'aperçu, seul script autorisé par la CSP de l'admin. */
export const PREVIEW_SCRIPT_HASH = `'sha256-${createHash('sha256').update(PREVIEW_SCRIPT).digest('base64')}'`

/** Script d'aperçu, une fois par page qui porte des champs d'image. */
export const imagePreviewScript = raw(`<script>${PREVIEW_SCRIPT}</script>`)

const helpText = (usage: Media.Usage): string => {
  const ratio = ratioOf(usage)
  const minimum = minimumWidth(usage)
  if (ratio === null) {
    return `PNG, WebP ou AVIF (transparence gardée) ou JPEG, 10 Mo au plus, sans recadrage, ${minimum} px de large au moins. Pas de SVG. Sans fichier, l'image actuelle est gardée.`
  }
  if (usage === 'icon') {
    return `PNG, WebP ou AVIF (transparence gardée), carrée, ${minimum} px de large au moins, recadrée au centre. Pas de SVG ni d'ICO. Les favicons sont générés en PNG de 32, 180, 192 et 512 px.`
  }
  const sharpest =
    minimum < largestWidth(usage)
      ? `, ${largestWidth(usage)} px pour la meilleure netteté (jamais agrandie)`
      : ''
  return `JPEG, PNG, WebP ou AVIF, 10 Mo au plus, recadrée au centre au format ${ratio[0]}:${ratio[1]}, ${minimum} px de large au moins${sharpest}. Sans fichier, l'image actuelle est gardée.`
}

/**
 * Champ d'envoi seul, précédé de l'aperçu de l'image actuelle (caché sans image) et suivi de son
 * aide. `name` : nom et identifiant du champ.
 */
export const imageFileHtml = (
  usage: Media.Usage,
  name: string,
  label: string,
  current: Media.Image | null,
  previewLabel = 'Image actuelle',
) =>
  html`<figure data-apercu="${name}" ${current === null ? 'hidden' : ''}>
      <img
        ${current === null ? '' : html`src="${previewUrl(current, usage)}"`}
        alt=""
        class="apercu"
      />
      <figcaption>
        ${current === null ? previewLabel : previewCaption(current, usage, previewLabel)}
      </figcaption>
    </figure>
    <label for="${name}">${label}</label>
    <input
      id="${name}"
      name="${name}"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/avif"
      aria-describedby="aide-${name}"
    />
    <p id="aide-${name}">${helpText(usage)}</p>`

/**
 * Champs d'image d'un formulaire. `current` : l'image enregistrée, montrée au-dessus du champ de
 * fichier. `decorative` à false : pas de case « décorative » (logo, image de partage, dont le texte
 * vaut le nom du site).
 */
export const imageFieldsHtml = (
  usage: Media.Usage,
  altHelp: string,
  values: Values,
  errors: Errors,
  current: Media.Image | null = null,
  {
    label = 'Image',
    decorative = true,
    prefix = 'image',
    previewLabel = 'Image actuelle',
  }: { label?: string; decorative?: boolean; prefix?: string; previewLabel?: string } = {},
) =>
  html`${imageFileHtml(usage, `${prefix}Content`, label, current, previewLabel)}
    ${textField('Texte de remplacement', `${prefix}Alt`, values, errors)}
    <p>${altHelp}</p>
    ${
      decorative
        ? checkboxField(
            'Image décorative (aucun texte de remplacement)',
            `${prefix}Decorative`,
            values,
          )
        : ''
    }`

/** Lecteur du fichier audio actuel d'un article, avant le champ d'envoi (ADR 0009). */
export const audioPreviewHtml = (audio: Media.Audio | null) =>
  audio === null
    ? ''
    : html`<figure data-apercu-audio>
        <audio controls preload="none" src="/media/${audioFileName(audio)}"></audio>
        <figcaption>
          Fichier audio actuel, ${audio.format.toUpperCase()}, ${audio.durationSeconds} s
        </figcaption>
      </figure>`
