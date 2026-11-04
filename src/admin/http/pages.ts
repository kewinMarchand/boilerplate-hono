import { html } from 'hono/html'

import { adminPage, publicPage } from '#/shared/http/adminLayout.ts'

export const loginPage = ({ error, email = '' }: { error?: string; email?: string } = {}) =>
  publicPage(
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
  adminPage(
    'Tableau de bord',
    '/admin',
    html`<h1>Administration</h1>
      <p>Connecté : ${email}</p>
      <ul>
        <li><a href="/admin/categories">Catégories du catalogue</a></li>
        <li><a href="/admin/produits">Produits du catalogue</a></li>
      </ul>`,
  )
