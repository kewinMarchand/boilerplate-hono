import { html } from 'hono/html'

import type { HtmlEscapedString } from 'hono/utils/html'

type Html = HtmlEscapedString | Promise<HtmlEscapedString>

/** Styles en ligne : la CSP des pages de l'admin n'autorise que eux (aucun fichier, aucun script). */
const STYLE = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; color: #1b1b1b; background: #f6f6f6; }
  body { margin: 0; }
  main { max-width: 28rem; margin: 4rem auto; padding: 2rem; background: #fff; border-radius: .5rem; }
  h1 { font-size: 1.5rem; margin-top: 0; }
  label { display: block; margin-top: 1rem; font-weight: 600; }
  input { display: block; width: 100%; box-sizing: border-box; margin-top: .25rem; padding: .6rem; font: inherit;
    border: 1px solid #6b6b6b; border-radius: .25rem; }
  button { margin-top: 1.5rem; padding: .6rem 1.2rem; font: inherit; color: #fff; background: #1d4ed8; border: 0;
    border-radius: .25rem; cursor: pointer; }
  :focus-visible { outline: 3px solid #1d4ed8; outline-offset: 2px; }
  [role="alert"] { padding: .75rem; color: #8a1c1c; background: #fdecec; border-radius: .25rem; }
`

export const layout = (title: string, body: Html) =>
  html`<!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <title>${title} · Administration</title>
        <style>
          ${STYLE}
        </style>
      </head>
      <body>
        <main>${body}</main>
      </body>
    </html>`

export const loginPage = ({ error, email = '' }: { error?: string; email?: string } = {}) =>
  layout(
    'Connexion',
    html`<h1>Administration</h1>
      ${error === undefined ? '' : html`<p role="alert" id="erreur-connexion">${error}</p>`}
      <form method="post" action="/admin/login">
        <label for="email">Adresse e-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="username"
          required
          value="${email}"
          ${error === undefined ? '' : html`aria-describedby="erreur-connexion"`}
        />
        <label for="password">Mot de passe</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <button type="submit">Se connecter</button>
      </form>`,
  )

export const dashboardPage = (email: string) =>
  layout(
    'Tableau de bord',
    html`<h1>Administration</h1>
      <p>Connecté : ${email}</p>
      <form method="post" action="/admin/logout">
        <button type="submit">Se déconnecter</button>
      </form>`,
  )
