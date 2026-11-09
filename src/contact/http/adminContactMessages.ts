import { Hono } from 'hono'
import { html } from 'hono/html'

import { adminLocale, t } from '#/shared/http/adminI18n.ts'
import { adminPage, notFoundPage } from '#/shared/http/adminLayout.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'

/**
 * Messages reçus par le contact et demandes de renseignement (SPEC-COMMUNE, section 27), en
 * lecture seule, comme ContactMessageCrudController de l'API Platform : un mail en échec ne laisse
 * le message qu'en base. Extrait de la liste coupé comme le fait EasyAdmin (64 caractères).
 */
const PATH = '/admin/messages'
const EXCERPT_LENGTH = 64

/** Date de réception, à l'heure de Paris, au format de la langue de l'interface. */
const DATE_FORMATS = {
  fr: new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  en: new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
}
const receivedAt = { format: (date: Date): string => DATE_FORMATS[adminLocale()].format(date) }

const excerpt = (message: string): string => {
  const characters = Array.from(message)
  return characters.length <= EXCERPT_LENGTH
    ? message
    : `${characters.slice(0, EXCERPT_LENGTH - 1).join('')}…`
}

const productLabel = (message: ContactMessage.Entity): string =>
  message.product ?? t('message.no_product')

const listPage = (messages: readonly ContactMessage.Entity[]) =>
  adminPage(
    t('entity.messages'),
    PATH,
    html`<h1>${t('entity.messages')}</h1>
      ${
        messages.length === 0
          ? html`<p>${t('message.none')}</p>`
          : html`<table>
              <thead>
                <tr>
                  <th scope="col">${t('field.received_at')}</th>
                  <th scope="col">${t('field.name')}</th>
                  <th scope="col">${t('field.email')}</th>
                  <th scope="col">${t('field.product')}</th>
                  <th scope="col">${t('field.message')}</th>
                  <th scope="col">${t('field.actions')}</th>
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
                          >${t('action.view')}<span class="sr">
                            ${t('message.of', { name: message.name })}</span
                          ></a
                        >
                      </td>
                    </tr>`,
                )}
              </tbody>
            </table>`
      }`,
  )

const detailPage = (message: ContactMessage.Entity) => {
  const title = t('title.message', { name: message.name })
  return adminPage(
    title,
    PATH,
    html`<h1>${title}</h1>
      <dl>
        <dt>${t('field.received_at')}</dt>
        <dd>${receivedAt.format(message.receivedAt)}</dd>
        <dt>${t('field.name')}</dt>
        <dd>${message.name}</dd>
        <dt>${t('field.email')}</dt>
        <dd>${message.email}</dd>
        <dt>${t('field.product')}</dt>
        <dd>${productLabel(message)}</dd>
        <dt>${t('field.message')}</dt>
        <dd>
          ${message.message
            .split('\n')
            .map((line, index) => (index === 0 ? line : html`<br />${line}`))}
        </dd>
      </dl>
      <p><a href="${PATH}">${t('message.back')}</a></p>`,
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
