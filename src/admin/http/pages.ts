import { html } from 'hono/html'

import { t } from '#/shared/http/adminI18n.ts'
import { adminPage, languageSwitcher, publicPage } from '#/shared/http/adminLayout.ts'

import type { MessageKey } from '#/shared/http/adminI18n.ts'

export const loginPage = ({ error, email = '' }: { error?: string; email?: string } = {}) =>
  publicPage(
    t('login.title'),
    html`${languageSwitcher()}
      <h1>${t('dashboard.title')}</h1>
      ${error === undefined ? '' : html`<p role="alert" id="erreur-connexion">${error}</p>`}
      <form method="post" action="/admin/login">
        <label for="email">${t('login.email')}</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="username"
          required
          value="${email}"
          ${error === undefined ? '' : html`aria-describedby="erreur-connexion"`}
        />
        <label for="password">${t('login.password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <button type="submit">${t('login.sign_in')}</button>
      </form>`,
  )

/** Sections du tableau de bord : adresse et clé du libellé. */
const SECTIONS: readonly (readonly [string, MessageKey])[] = [
  ['/admin/categories', 'dashboard.categories'],
  ['/admin/produits', 'dashboard.products'],
  ['/admin/attributs', 'dashboard.attributes'],
  ['/admin/articles', 'dashboard.articles'],
  ['/admin/rubriques', 'dashboard.sections'],
  ['/admin/formats', 'dashboard.formats'],
  ['/admin/pages-legales', 'menu.legal_pages'],
  ['/admin/identite-du-site', 'menu.site_identity'],
  ['/admin/referencement', 'dashboard.page_metas'],
  ['/admin/messages', 'dashboard.messages'],
]

export const dashboardPage = (email: string) =>
  adminPage(
    t('menu.dashboard'),
    '/admin',
    html`<h1>${t('dashboard.title')}</h1>
      <p>${t('dashboard.signed_in', { email })}</p>
      <ul>
        ${SECTIONS.map(([path, label]) => html`<li><a href="${path}">${t(label)}</a></li>`)}
      </ul>`,
  )
