import { html } from 'hono/html'

import {
  ADMIN_LOCALE_NAMES,
  ADMIN_LOCALES,
  adminLocale,
  adminPath,
  LOCALE_QUERY,
  t,
} from './adminI18n.ts'

import type { MessageKey } from './adminI18n.ts'
import type { HtmlEscapedString } from 'hono/utils/html'

export type Html = HtmlEscapedString | Promise<HtmlEscapedString>

/**
 * Mise en page des pages de l'admin (ADR 0001), commune aux modules : connexion, catalogue,
 * contenus. Styles en ligne : la CSP des pages de l'admin n'autorise qu'eux, les images du même
 * hôte et le seul script d'aperçu des images (adminImageFields). Damier sous l'aperçu : la
 * transparence d'un logo ou d'une icône se voit. `.sr` : texte pour les lecteurs d'écran seulement
 * (« Supprimer Monstera » plutôt qu'une suite de « Supprimer »). Onglets de langue du contenu :
 * boutons radio, un panneau visible à la fois, sans script. Pas de `>` dans ces styles : le gabarit
 * l'échapperait en `&gt;`, que le navigateur ne décode pas dans `<style>`.
 */
const STYLE = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #1b1b1b; background: #f6f6f6; }
  body { margin: 0; }
  header { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; padding: .75rem 1.5rem; background: #fff;
    border-bottom: 1px solid #d0d0d0; }
  header nav ul { display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; padding: 0; list-style: none; }
  header form { margin-left: auto; }
  main { max-width: 56rem; margin: 2rem auto; padding: 2rem; background: #fff; border-radius: .5rem; }
  main.etroit { max-width: 28rem; margin-top: 4rem; }
  h1 { font-size: 1.5rem; margin-top: 0; }
  a { color: #1d4ed8; }
  label { display: block; margin-top: 1rem; font-weight: 600; }
  input, select { display: block; width: 100%; box-sizing: border-box; margin-top: .25rem; padding: .6rem; font: inherit;
    border: 1px solid #6b6b6b; border-radius: .25rem; }
  input[type="checkbox"] { display: inline; width: auto; margin-right: .5rem; }
  button { margin-top: 1.5rem; padding: .6rem 1.2rem; font: inherit; color: #fff; background: #1d4ed8; border: 0;
    border-radius: .25rem; cursor: pointer; }
  button.danger { background: #b42318; }
  header button { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: .5rem; text-align: left; border-bottom: 1px solid #e0e0e0; }
  td form { display: inline; }
  td button { margin-top: 0; padding: .3rem .6rem; }
  img.vignette { height: auto; border-radius: .25rem; }
  figure { margin: 1rem 0 0; }
  img.apercu { display: block; max-width: 20rem; height: auto; border-radius: .25rem;
    background: repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
  fieldset { margin: 1.5rem 0 0; padding: 1rem; border: 1px solid #d0d0d0; border-radius: .25rem; }
  .erreur-champ { margin: .25rem 0 0; color: #8a1c1c; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  :focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  [role="alert"] { padding: .75rem; color: #8a1c1c; background: #fdecec; border-radius: .25rem; }
  [role="status"] { padding: .75rem; color: #14532d; background: #e7f6ec; border-radius: .25rem; }
  nav.langues ul { display: flex; gap: .75rem; margin: 0; padding: 0; list-style: none; }
  main.etroit nav.langues { margin-bottom: 1rem; }
  .onglets { margin-top: 1.5rem; }
  .onglets fieldset.choix { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0; padding: 0; border: 0; }
  .onglets fieldset.choix legend { margin-bottom: .5rem; font-weight: 600; }
  .onglets fieldset.choix label { display: inline-flex; margin: 0; padding: .4rem .8rem; border: 1px solid #6b6b6b;
    border-radius: .25rem; cursor: pointer; font-weight: 400; }
  .onglets fieldset.choix input { position: absolute; width: 1px; opacity: 0; }
  .onglets fieldset.choix input:checked + label { color: #fff; background: #1d4ed8; border-color: #1d4ed8; }
  .onglets fieldset.choix input:focus-visible + label { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  .onglets .panneau { display: none; padding: 0 1rem 1rem; border: 1px solid #d0d0d0; border-radius: .25rem; }
`

/** Entrées du menu de l'admin : chemin et clé du libellé. */
const MENU: readonly (readonly [string, MessageKey])[] = [
  ['/admin', 'menu.dashboard'],
  ['/admin/categories', 'menu.categories'],
  ['/admin/produits', 'menu.products'],
  ['/admin/attributs', 'menu.attributes'],
  ['/admin/articles', 'menu.articles'],
  ['/admin/rubriques', 'menu.sections'],
  ['/admin/formats', 'menu.formats'],
  ['/admin/pages-legales', 'menu.legal_pages'],
  ['/admin/identite-du-site', 'menu.site_identity'],
  ['/admin/referencement', 'menu.page_metas'],
  ['/admin/messages', 'menu.messages'],
]

/**
 * Sélecteur de la langue de l'interface (ADR 0014) : un lien par langue, écrite dans sa langue, vers
 * la page en cours ; le choix est mémorisé.
 */
export const languageSwitcher = () =>
  html`<nav class="langues" aria-label="${t('layout.interface_language')}">
    <ul>
      ${ADMIN_LOCALES.map(
        (locale) =>
          html`<li>
            <a
              href="${adminPath()}?${LOCALE_QUERY}=${locale}"
              hreflang="${locale}"
              lang="${locale}"
              ${locale === adminLocale() ? html`aria-current="true"` : ''}
              >${ADMIN_LOCALE_NAMES[locale]}</a
            >
          </li>`,
      )}
    </ul>
  </nav>`

const header = (current: string) =>
  html`<header>
    <nav aria-label="${t('dashboard.title')}">
      <ul>
        ${MENU.map(
          ([path, label]) =>
            html`<li>
              <a href="${path}" ${path === current ? html`aria-current="page"` : ''}>${t(label)}</a>
            </li>`,
        )}
      </ul>
    </nav>
    ${languageSwitcher()}
    <form method="post" action="/admin/logout">
      <button type="submit">${t('layout.sign_out')}</button>
    </form>
  </header>`

const document = (title: string, body: Html) =>
  html`<!doctype html>
    <html lang="${adminLocale()}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>${title} · ${t('dashboard.title')}</title>
        <style>
          ${STYLE}
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>`

/** Page d'un compte connecté : menu, puis le contenu. `current` : chemin de l'entrée du menu en cours. */
export const adminPage = (title: string, current: string, body: Html) =>
  document(
    title,
    html`${header(current)}
      <main>${body}</main>`,
  )

/** Page hors session (connexion) : sans menu. */
export const publicPage = (title: string, body: Html) =>
  document(title, html`<main class="etroit">${body}</main>`)

/**
 * Élément demandé introuvable (supprimé, adresse modifiée). Pas `c.notFound()` : il passe par la
 * réponse du routeur de l'API, qui voit la route POST du même chemin et répond 405 en JSON.
 */
export const notFoundPage = () =>
  adminPage(
    t('not_found.title'),
    '',
    html`<h1>${t('not_found.title')}</h1>
      <p>${t('not_found.text')}</p>
      <p><a href="/admin">${t('not_found.back')}</a></p>`,
  )

/** Message de réussite, après une redirection (paramètre `ok` de l'adresse). */
export const flash = (message: string | undefined) =>
  message === undefined ? '' : html`<p role="status">${message}</p>`

/** Erreur d'une règle du catalogue ou des contenus, en tête de formulaire. */
export const formError = (message: string | undefined) =>
  message === undefined ? '' : html`<p role="alert" id="erreur-formulaire">${message}</p>`
