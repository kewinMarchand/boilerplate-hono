import { z } from 'zod'

import { CONTACT_LIMITS, contactMessageViolations } from '#/contact/domain/ContactMessage.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'

/** Messages exacts de l'API Platform (ContactMessageResource), à garder identiques au caractère près. */
export const CONTACT_ERRORS = {
  name: 'Indiquez votre nom (2 caractères minimum).',
  email: 'Indiquez une adresse e-mail valide, par exemple nom@domaine.fr.',
  message: 'Votre message doit contenir au moins 10 caractères.',
} as const

export const CONTACT_TOO_LONG_ERRORS = {
  name: `Votre nom ne doit pas dépasser ${CONTACT_LIMITS.nameMaxLength} caractères.`,
  email: `Votre adresse e-mail ne doit pas dépasser ${CONTACT_LIMITS.emailMaxLength} caractères.`,
  message: `Votre message ne doit pas dépasser ${CONTACT_LIMITS.messageMaxLength} caractères.`,
} as const

/**
 * Slug inconnu du catalogue sur une demande de renseignement (SPEC-COMMUNE, section 27). Vérifié
 * par le cas d'usage, donc seulement quand les champs de texte sont valides, sans code de
 * contrainte (null), comme la violation levée par le processeur de l'API Platform.
 */
export const UNKNOWN_PRODUCT_VIOLATION: ContactViolation = {
  propertyPath: 'product',
  message: "Ce produit n'existe pas.",
  code: null,
}

/** Codes des contraintes Symfony, renvoyés tels quels par API Platform dans `violations[].code`. */
export const CONSTRAINT_CODES = {
  notNull: 'ad32d13f-c3d4-423b-909a-857b961eb720',
  notBlank: 'c1051bb4-d103-4f74-8988-acbcafc7fdc3',
  tooShort: '9ff3fdc4-b214-49db-8718-39c315e33d45',
  tooLong: 'd94b19cc-114f-4f44-9cc4-4138e80a87b9',
  invalidEmail: 'bd79c0ab-ddba-46cc-a703-a7a4b08de310',
  type: 'ba785a8c-82cb-4283-967c-3cf342181b40',
} as const

export interface ContactViolation {
  readonly propertyPath: ContactMessage.WritableField
  readonly message: string
  readonly code: string | null
}

/** trim() de PHP : espaces, tabulations, retours à la ligne, NUL et tabulation verticale. */
export const phpTrim = (value: string): string =>
  value.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')

/** Contrainte Symfony équivalente : NotNull pour le nom et le message, NotBlank pour l'e-mail. */
const MISSING_CODES: Record<ContactMessage.Field, string> = {
  name: CONSTRAINT_CODES.notNull,
  email: CONSTRAINT_CODES.notBlank,
  message: CONSTRAINT_CODES.notNull,
}

export const toContactViolation = ({ field, kind }: ContactMessage.Violation): ContactViolation => {
  switch (kind) {
    case 'missing':
      return { propertyPath: field, message: CONTACT_ERRORS[field], code: MISSING_CODES[field] }
    case 'tooShort':
      return {
        propertyPath: field,
        message: CONTACT_ERRORS[field],
        code: CONSTRAINT_CODES.tooShort,
      }
    case 'tooLong':
      return {
        propertyPath: field,
        message: CONTACT_TOO_LONG_ERRORS[field],
        code: CONSTRAINT_CODES.tooLong,
      }
    case 'invalidFormat':
      return {
        propertyPath: field,
        message: CONTACT_ERRORS[field],
        code: CONSTRAINT_CODES.invalidEmail,
      }
  }
}

export const contactMessageContract = z
  .object({
    id: z.int().nullable().optional().meta({ readOnly: true }),
    name: z.string().nullable().meta({
      minLength: CONTACT_LIMITS.nameMinLength,
      maxLength: CONTACT_LIMITS.nameMaxLength,
    }),
    email: z
      .string()
      .nullable()
      .meta({ format: 'email', maxLength: CONTACT_LIMITS.emailMaxLength }),
    message: z.string().nullable().meta({
      minLength: CONTACT_LIMITS.messageMinLength,
      maxLength: CONTACT_LIMITS.messageMaxLength,
    }),
    product: z.string().nullable().optional().meta({
      description:
        "Slug du produit d'une demande de renseignement ; null ou absent pour un message de contact simple.",
    }),
    receivedAt: z.iso.datetime({ offset: true }).nullable().optional().meta({ readOnly: true }),
  })
  .meta({
    id: 'ContactMessage',
    description:
      "Enregistre un message de contact, ou une demande de renseignement sur un produit, puis l'envoie par mail. Répond 422 avec la liste des violations si un champ est invalide ou si le produit n'existe pas ; un mail non envoyé ne change pas la réponse.",
  })

export type ContactMessageOutput = z.infer<typeof contactMessageContract>

const writableText = z.string().nullable().optional()

const contactMessageInputContract = z.object({
  name: writableText.meta({
    minLength: CONTACT_LIMITS.nameMinLength,
    maxLength: CONTACT_LIMITS.nameMaxLength,
  }),
  email: writableText.meta({ format: 'email', maxLength: CONTACT_LIMITS.emailMaxLength }),
  message: writableText.meta({
    minLength: CONTACT_LIMITS.messageMinLength,
    maxLength: CONTACT_LIMITS.messageMaxLength,
  }),
  product: writableText,
})

export type ContactMessageInput = z.infer<typeof contactMessageInputContract>

/**
 * Traduit la saisie en candidat du domaine avec la sémantique Symfony : absent vaut null, le nom
 * et le message sont mesurés après trim() de PHP, l'e-mail tel quel.
 */
export const toCandidate = (input: ContactMessageInput): ContactMessage.Candidate => ({
  name: input.name === null || input.name === undefined ? null : phpTrim(input.name),
  email: input.email ?? null,
  message: input.message === null || input.message === undefined ? null : phpTrim(input.message),
})

export const contactViolations = (input: ContactMessageInput): ContactViolation[] =>
  contactMessageViolations(toCandidate(input)).map(toContactViolation)

/** Corps de la requête : la forme (chaîne ou null), puis les règles du domaine traduites. */
export const contactMessageWriteContract = contactMessageInputContract.superRefine(
  (input, context) => {
    for (const violation of contactViolations(input)) {
      context.addIssue({
        code: 'custom',
        path: [violation.propertyPath],
        message: violation.message,
        params: { code: violation.code },
      })
    }
  },
)

const CONTACT_FIELDS: readonly unknown[] = ['name', 'email', 'message']

const isContactField = (value: unknown): value is ContactMessage.Field =>
  CONTACT_FIELDS.includes(value)

/** Relit les violations portées par les issues de contactMessageWriteContract (null si autre erreur). */
export const violationsFromIssues = (
  issues: readonly z.core.$ZodIssue[],
): ContactViolation[] | null => {
  const violations = issues.flatMap((issue) => {
    const [field] = issue.path
    const code: unknown = issue.code === 'custom' ? issue.params?.['code'] : undefined
    return isContactField(field) && typeof code === 'string'
      ? [{ propertyPath: field, message: issue.message, code }]
      : []
  })

  return violations.length === issues.length ? violations : null
}

export const toDraft = (input: ContactMessageInput, receivedAt: Date): ContactMessage.Draft => ({
  name: phpTrim(input.name ?? ''),
  email: phpTrim(input.email ?? ''),
  message: phpTrim(input.message ?? ''),
  product: input.product ?? null,
  receivedAt,
})
