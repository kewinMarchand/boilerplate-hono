export declare namespace AdminUser {
  /** Compte d'administration : l'adresse e-mail, normalisée, est son identifiant. */
  interface Entity {
    readonly email: string
    readonly passwordHash: string
  }

  interface Repository {
    findByEmail(email: string): Promise<Entity | null>
    save(user: Entity): Promise<void>
  }

  interface PasswordHasher {
    hash(password: string): Promise<string>
    verify(password: string, hash: string): Promise<boolean>
  }
}

/** Même longueur minimale que la commande app:admin:create de l'API Platform. */
export const MIN_PASSWORD_LENGTH = 12

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Un compte par adresse, quelle que soit la casse saisie. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export const isValidEmail = (email: string): boolean => EMAIL.test(email)

export class InvalidEmailError extends Error {
  constructor(email: string) {
    super(`Adresse e-mail invalide : ${email}`)
    this.name = 'InvalidEmailError'
  }
}

export class PasswordTooShortError extends Error {
  constructor() {
    super(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
    this.name = 'PasswordTooShortError'
  }
}
