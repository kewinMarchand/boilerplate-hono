import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { bodyLimit } from 'hono/body-limit'

import { negotiateFormat, requireJsonContentType } from '#/shared/http/contentNegotiation.ts'
import { DeserializationError, PayloadTooLargeError } from '#/shared/http/httpErrors.ts'
import {
  constraintViolationSchema,
  errorSchema,
  problemContent,
} from '#/shared/http/problemSchemas.ts'
import { scenario } from '#/shared/http/scenario.ts'

import { UnknownProductError } from '#/contact/domain/ContactMessage.ts'
import { receiveContactMessage } from '#/contact/application/receiveContactMessage.ts'

import { ContactMessageValidationError } from './ContactMessageValidationError.ts'
import {
  contactMessageContract,
  contactMessageWriteContract,
  contactViolations,
  toDraft,
  UNKNOWN_PRODUCT_VIOLATION,
  violationsFromIssues,
} from './contract.ts'
import { deserializeContactMessage } from './deserializeContactMessage.ts'

import type { ContactMessageOutput } from './contract.ts'
import type { ContactDependencies } from '#/contact/application/receiveContactMessage.ts'
import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import type { RouteOptions } from '#/shared/http/routeOptions.ts'

/** Large au-dessus du plus gros corps valide (5000 caractères de message, 4 octets au plus chacun). */
const MAX_BODY_KILOBYTES = 64

const limitBody = bodyLimit({
  maxSize: MAX_BODY_KILOBYTES * 1024,
  onError: () => {
    throw new PayloadTooLargeError(MAX_BODY_KILOBYTES)
  },
})

/** Date-heure ISO à la seconde avec décalage explicite, comme le DateTimeNormalizer de Symfony. */
const toIsoSeconds = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, '+00:00')

const toOutput = (message: ContactMessage.Entity): ContactMessageOutput => ({
  id: message.id,
  name: message.name,
  email: message.email,
  message: message.message,
  // Absent plutôt que null, comme la sortie de l'API Platform (skip_null_values)
  ...(message.product === null ? {} : { product: message.product }),
  receivedAt: toIsoSeconds(message.receivedAt),
})

/** `onMailFailure` : journal de l'envoi en échec, la réponse reste 201 (SPEC-COMMUNE, section 27). */
export const contactMessageRoutes = (
  dependencies: ContactDependencies,
  options: RouteOptions,
  onMailFailure: (error: unknown) => void,
) =>
  new OpenAPIHono().openapi(
    createRoute({
      method: 'post',
      path: '/api/contact_messages',
      operationId: 'api_contact_messages_post',
      tags: ['ContactMessage'],
      summary: 'Creates a ContactMessage resource.',
      description: 'Creates a ContactMessage resource.',
      middleware: [
        limitBody,
        requireJsonContentType,
        negotiateFormat(),
        scenario(options.scenarios),
        deserializeContactMessage,
      ],
      request: {
        body: {
          required: true,
          description: 'The new ContactMessage resource',
          content: { 'application/json': { schema: contactMessageWriteContract } },
        },
      },
      responses: {
        201: {
          description: 'ContactMessage resource created',
          content: { 'application/json': { schema: contactMessageContract } },
        },
        400: { description: 'Invalid input', content: problemContent(errorSchema) },
        413: { description: 'Payload too large', content: problemContent(errorSchema) },
        422: {
          description: 'An error occurred',
          content: problemContent(constraintViolationSchema),
        },
      },
    }),
    async (c) => {
      let saved: ContactMessage.Entity
      try {
        saved = await receiveContactMessage(
          dependencies,
          toDraft(c.req.valid('json'), new Date()),
          (await options.contentLocale(c.req.raw)).current,
          onMailFailure,
        )
      } catch (error) {
        throw error instanceof UnknownProductError
          ? new ContactMessageValidationError([UNKNOWN_PRODUCT_VIOLATION])
          : error
      }
      const location = `/api/contact_messages/${saved.id}`

      return c.json(toOutput(saved), 201, {
        Location: location,
        'Content-Location': `${location}.json`,
      })
    },
    (result) => {
      if (!result.success) {
        const { issues } = result.error
        // Un tableau JSON est désérialisé par PHP comme un objet sans aucun des champs attendus.
        if (issues.every((issue) => issue.path.length === 0)) {
          throw new ContactMessageValidationError(contactViolations({}))
        }
        const violations = violationsFromIssues(issues)
        if (violations === null) {
          throw new DeserializationError(result.error.message)
        }
        throw new ContactMessageValidationError(violations)
      }
    },
  )
