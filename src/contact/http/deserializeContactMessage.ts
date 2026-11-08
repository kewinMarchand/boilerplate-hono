import { createMiddleware } from 'hono/factory'

import { DeserializationError } from '#/shared/http/httpErrors.ts'

import { ContactMessageValidationError } from './ContactMessageValidationError.ts'
import { CONSTRAINT_CODES } from './contract.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'

const WRITABLE_FIELDS: ReadonlySet<string> = new Set<ContactMessage.WritableField>([
  'name',
  'email',
  'message',
  'product',
])

const isWritableField = (key: string): key is ContactMessage.WritableField =>
  WRITABLE_FIELDS.has(key)

/** Nom du type PHP (gettype) d'une valeur JSON décodée par json_decode. */
const phpType = (value: unknown): string => {
  if (value === null) {
    return 'NULL'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? 'integer' : 'double'
  }

  return typeof value === 'string' ? 'string' : 'array'
}

/**
 * Erreurs de désérialisation du serializer Symfony, que l'API Platform renvoie en 500 avant
 * toute validation : corps non objet, identifiant fourni sur une création.
 */
export const deserializationError = (body: unknown): string | null => {
  if (typeof body === 'string') {
    return `Invalid IRI "${body}".`
  }
  if (typeof body !== 'object' || body === null) {
    return `The type of the "ContactMessage" resource must be "array" (nested document) or "string" (IRI), "${phpType(body)}" given.`
  }

  return Object.entries(body).some(([key, value]) => key === 'id' && value !== null)
    ? 'Update is not allowed for this operation.'
    : null
}

/**
 * Premier champ du corps ni chaîne ni null : l'API Platform le refuse en 422 (contrainte Type),
 * seul, avant les règles du formulaire.
 */
export const invalidTypeField = (body: unknown): ContactMessage.WritableField | null => {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const invalid = Object.entries(body).find(
    (entry): entry is [ContactMessage.WritableField, unknown] =>
      isWritableField(entry[0]) && entry[1] !== null && typeof entry[1] !== 'string',
  )

  return invalid === undefined ? null : invalid[0]
}

export const deserializeContactMessage = createMiddleware(async (c, next) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new DeserializationError('Syntax error')
  }
  const error = deserializationError(body)
  if (error !== null) {
    throw new DeserializationError(error)
  }
  const field = invalidTypeField(body)
  if (field !== null) {
    throw new ContactMessageValidationError([
      {
        propertyPath: field,
        message: 'This value should be of type null|string.',
        code: CONSTRAINT_CODES.type,
      },
    ])
  }
  await next()
})
