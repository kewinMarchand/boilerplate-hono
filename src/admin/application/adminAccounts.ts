import {
  InvalidEmailError,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  PasswordTooShortError,
} from '#/admin/domain/AdminUser.ts'

import type { AdminUser } from '#/admin/domain/AdminUser.ts'

export interface AdminDependencies {
  readonly adminUsers: AdminUser.Repository
  readonly passwordHasher: AdminUser.PasswordHasher
}

/**
 * Compte dont l'adresse et le mot de passe correspondent, sinon null. Une adresse inconnue fait
 * aussi hacher le mot de passe : le temps de réponse ne dit pas quelles adresses ont un compte.
 */
export const authenticate = async (
  { adminUsers, passwordHasher }: AdminDependencies,
  email: string,
  password: string,
): Promise<AdminUser.Entity | null> => {
  const user = await adminUsers.findByEmail(normalizeEmail(email))
  if (user === null) {
    await passwordHasher.hash(password)
    return null
  }

  return (await passwordHasher.verify(password, user.passwordHash)) ? user : null
}

/** Crée le compte, ou change son mot de passe s'il existe : commande `make admin`. */
export const saveAdmin = async (
  { adminUsers, passwordHasher }: AdminDependencies,
  email: string,
  password: string,
): Promise<AdminUser.Entity> => {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) {
    throw new InvalidEmailError(email)
  }
  // Points de code, comme mb_strlen de la commande de l'API Platform
  if (Array.from(password).length < MIN_PASSWORD_LENGTH) {
    throw new PasswordTooShortError()
  }
  const user = { email: normalized, passwordHash: await passwordHasher.hash(password) }
  await adminUsers.save(user)

  return user
}
