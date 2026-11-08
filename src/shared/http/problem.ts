import { JSON_MIME, JSONLD_MIME, negotiate, PROBLEM_MIME } from './negotiation.ts'

export type ErrorFlavor = 'plain' | 'jsonld'

/**
 * API Platform choisit le format d'erreur parmi JSON-LD, problem+json et JSON.
 * JSON-LD (avec @context, @id, @type et description) l'emporte pour toute plage générique
 * (`*\/*`, `application/*`) ou sans correspondance, le JSON simple seulement si le client
 * demande explicitement `application/json` ou n'envoie pas d'en-tête Accept.
 */
export const errorFlavor = (accept: string | undefined): ErrorFlavor => {
  if (accept === undefined || accept === '') {
    return 'plain'
  }
  const best = negotiate(accept, [JSONLD_MIME, PROBLEM_MIME, JSON_MIME])

  return best === null || best === JSONLD_MIME ? 'jsonld' : 'plain'
}

export interface Violation {
  readonly propertyPath: string
  readonly message: string
  /** null pour une violation levée hors contrainte Symfony (produit inconnu du contact). */
  readonly code: string | null
}

const TITLE = 'An error occurred'

export const problemBody = (flavor: ErrorFlavor, status: number, detail: string) => {
  const plain = { title: TITLE, detail, status, type: `/errors/${status}` }
  if (flavor === 'plain') {
    return plain
  }

  return {
    '@context': '/api/contexts/Error',
    '@id': `/api/errors/${status}`,
    '@type': 'Error',
    ...plain,
    description: detail,
  }
}

export const violationsBody = (flavor: ErrorFlavor, violations: readonly Violation[]) => {
  const id =
    violations.length === 1
      ? (violations[0]?.code ?? '')
      : violations.map((violation, index) => `${index}=${violation.code}`).join(';')
  const detail = violations
    .map((violation) => `${violation.propertyPath}: ${violation.message}`)
    .join('\n')
  const type = `/validation_errors/${id}`

  if (flavor === 'plain') {
    return { status: 422, violations, detail, type, title: TITLE }
  }

  return {
    '@context': '/api/contexts/ConstraintViolation',
    '@id': `/api${type}`,
    '@type': 'ConstraintViolation',
    status: 422,
    violations,
    detail,
    description: detail,
    type,
    title: TITLE,
  }
}

export const routingErrorBody = (status: 404 | 405, detail: string) => ({
  type: 'https://tools.ietf.org/html/rfc2616#section-10',
  title: TITLE,
  status,
  detail,
})
