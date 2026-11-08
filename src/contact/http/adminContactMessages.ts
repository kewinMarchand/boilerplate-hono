import { Hono } from 'hono'
import { html } from 'hono/html'

import { adminPage, notFoundPage } from '#/shared/http/adminLayout.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'

/**
 * Messages reçus par le contact et demandes de renseignement (SPEC-COMMUNE, section 27), en
 * lecture seule, comme ContactMessageCrudController de l'API Platform : un mail en échec ne laisse
 * le message qu'en base. Extrait de la liste coupé comme le fait EasyAdmin (64 caractères).
 */
const PATH = '/admin/messages'
const TITLE = 'Messages'
const EXCERPT_LENGTH = 64

const receivedAt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const excerpt = (message: string): string => {
  const characters = Array.from(message)
  return characters.length <= EXCERPT_LENGTH
    ? message
    : `${characters.slice(0, EXCERPT_LENGTH - 1).join('')}…`
}

const productLabel = (message: ContactMessage.Entity): string => message.product ?? 'Aucun'

const listPage = (messages: readonly ContactMessage.Entity[]) =>
  adminPage(
    TITLE,
    PATH,
    html`<h1>${TITLE}</h1>
      ${
        messages.length === 0
          ? html`<p>Aucun message reçu.</p>`
          : html`<table>
              <thead>
                <tr>
                  <th scope="col">Reçu le</th>
                  <th scope="col">Nom</th>
                  <th scope="col">Adresse e-mail</th>
                  <th scope="col">Produit</th>
                  <th scope="col">Message</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${messages.map(
                  (message) =>
                    html`<tr>
                      <td>${receivedAt.format(message.receivedAt)}</td>
                      <td>${message.name}</td>
                      <td>${message.email}</td>
                      <td>${productLabel(message)}</td>
                      <td>${excerpt(message.message)}</td>
                      <td>
                        <a href="${PATH}/${message.id}"
                          >Consulter<span class="sr"> le message de ${message.name}</span></a
                        >
                      </td>
                    </tr>`,
                )}
              </tbody>
            </table>`
      }`,
  )

const detailPage = (message: ContactMessage.Entity) => {
  const title = `Message de ${message.name}`
  return adminPage(
    title,
    PATH,
    html`<h1>${title}</h1>
      <dl>
        <dt>Reçu le</dt>
        <dd>${receivedAt.format(message.receivedAt)}</dd>
        <dt>Nom</dt>
        <dd>${message.name}</dd>
        <dt>Adresse e-mail</dt>
        <dd>${message.email}</dd>
        <dt>Produit</dt>
        <dd>${productLabel(message)}</dd>
        <dt>Message</dt>
        <dd>
          ${message.message
            .split('\n')
            .map((line, index) => (index === 0 ? line : html`<br />${line}`))}
        </dd>
      </dl>
      <p><a href="${PATH}">Retour aux messages</a></p>`,
  )
}

export const adminContactMessageRoutes = (dependencies: {
  readonly contactMessages: ContactMessage.Repository
}) => {
  const app = new Hono()

  app.get(PATH, async (c) => c.html(listPage(await dependencies.contactMessages.findLatestFirst())))

  app.get(`${PATH}/:id{[0-9]+}`, async (c) => {
    const message = await dependencies.contactMessages.find(Number(c.req.param('id')))
    return message === null ? c.html(notFoundPage(), 404) : c.html(detailPage(message))
  })

  return app
}
