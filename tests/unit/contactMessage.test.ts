import { describe, expect, it } from 'vitest'

import { contactMessageViolations } from '#/contact/domain/ContactMessage.ts'
import {
  CONSTRAINT_CODES,
  CONTACT_ERRORS,
  CONTACT_TOO_LONG_ERRORS,
  contactMessageWriteContract,
  contactViolations,
  phpTrim,
  violationsFromIssues,
} from '#/contact/http/contract.ts'
import { deserializationError, invalidTypeField } from '#/contact/http/deserializeContactMessage.ts'

const VALID = { name: 'Camille', email: 'a@b.fr', message: 'Un message assez long.' }

describe('contactMessageViolations (domaine)', () => {
  it('signale chaque champ absent, dans l’ordre des champs', () => {
    expect(contactMessageViolations({ name: null, email: null, message: null })).toEqual([
      { field: 'name', kind: 'missing' },
      { field: 'email', kind: 'missing' },
      { field: 'message', kind: 'missing' },
    ])
  })

  it('traite un e-mail vide comme absent', () => {
    expect(contactMessageViolations({ ...VALID, email: '' })).toEqual([
      { field: 'email', kind: 'missing' },
    ])
  })

  it('compte les caractères en points de code', () => {
    expect(contactMessageViolations({ ...VALID, name: 'A', message: '😀'.repeat(10) })).toEqual([
      { field: 'name', kind: 'tooShort' },
    ])
  })

  it('valide l’e-mail au format HTML5 avec domaine de premier niveau', () => {
    const kinds = (email: string) =>
      contactMessageViolations({ ...VALID, email }).map((violation) => violation.kind)
    expect(kinds('camille@example.fr')).toEqual([])
    expect(kinds('a@b')).toEqual(['invalidFormat'])
    expect(kinds(' a@b.fr')).toEqual(['invalidFormat'])
  })

  it.each([
    ['name', { ...VALID, name: 'a'.repeat(256) }],
    ['email', { ...VALID, email: `${'a'.repeat(251)}@b.fr` }],
    ['message', { ...VALID, message: 'm'.repeat(5001) }],
  ] as const)('refuse un champ %s trop long', (field, candidate) => {
    expect(contactMessageViolations(candidate)).toEqual([{ field, kind: 'tooLong' }])
  })

  it('accepte les longueurs maximales exactes', () => {
    expect(
      contactMessageViolations({
        name: 'a'.repeat(255),
        email: 'a@b.fr',
        message: 'm'.repeat(5000),
      }),
    ).toEqual([])
  })
})

describe('contrat du formulaire de contact', () => {
  it('traduit chaque champ absent avec NotNull ou NotBlank et les messages exacts', () => {
    expect(contactViolations({})).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.notNull },
      { propertyPath: 'email', message: CONTACT_ERRORS.email, code: CONSTRAINT_CODES.notBlank },
      { propertyPath: 'message', message: CONTACT_ERRORS.message, code: CONSTRAINT_CODES.notNull },
    ])
  })

  it('mesure le nom et le message après le trim de PHP', () => {
    expect(contactViolations({ name: ' A ', email: 'a@b.fr', message: '\t0123456789\n' })).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.tooShort },
    ])
    expect(contactViolations({ ...VALID, name: ' A ' })).toEqual([])
  })

  it.each(['name', 'email', 'message'] as const)(
    'donne le message français de dépassement pour %s',
    (field) => {
      const input = {
        ...VALID,
        [field]: field === 'email' ? `${'a'.repeat(251)}@b.fr` : 'x'.repeat(6000),
      }
      expect(contactViolations(input)).toEqual([
        {
          propertyPath: field,
          message: CONTACT_TOO_LONG_ERRORS[field],
          code: CONSTRAINT_CODES.tooLong,
        },
      ])
    },
  )

  it('porte les violations dans les issues zod', () => {
    const result = contactMessageWriteContract.safeParse({ ...VALID, name: 'A' })
    expect(result.success).toBe(false)
    expect(violationsFromIssues(result.error?.issues ?? [])).toEqual([
      { propertyPath: 'name', message: CONTACT_ERRORS.name, code: CONSTRAINT_CODES.tooShort },
    ])
  })

  it('reproduit trim() de PHP, qui garde l’espace insécable', () => {
    expect(phpTrim(' \t x \n')).toBe(' x ')
  })
})

describe('deserializationError', () => {
  it.each([
    ['"abc"', 'Invalid IRI "abc".'],
    ['{"id":5,"name":"Cam"}', 'Update is not allowed for this operation.'],
    ['{"id":5,"name":1}', 'Update is not allowed for this operation.'],
    [
      'true',
      'The type of the "ContactMessage" resource must be "array" (nested document) or "string" (IRI), "boolean" given.',
    ],
  ])('%s', (body, expected) => {
    expect(deserializationError(JSON.parse(body))).toBe(expected)
  })

  it('accepte les objets et tableaux, même mal typés', () => {
    expect(deserializationError({ id: null, name: 1, foo: 1 })).toBeNull()
    expect(deserializationError([])).toBeNull()
  })
})

describe('invalidTypeField', () => {
  it.each([
    ['{"message":1,"name":true}', 'message'],
    ['{"name":1.5}', 'name'],
    ['{"name":{}}', 'name'],
    ['{"email":["a"]}', 'email'],
  ])('%s : %s', (body, expected) => {
    expect(invalidTypeField(JSON.parse(body))).toBe(expected)
  })

  it('ignore null, les chaînes et les champs inconnus', () => {
    expect(invalidTypeField({ name: null, email: 'a', foo: 1 })).toBeNull()
    expect(invalidTypeField([])).toBeNull()
  })
})
