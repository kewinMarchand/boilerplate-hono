import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

import type { AdminUser } from '#/admin/domain/AdminUser.ts'

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/** Coût de scrypt : 2^15 en production (recommandation OWASP) ; les tests en passent un plus bas. */
export const SCRYPT_COST = 2 ** 15

const derive = (password: string, salt: Buffer, cost: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: cost, r: 8, p: 1, maxmem: 256 * cost * 8 },
      (error, key) => {
        if (error) {
          reject(error)
        } else {
          resolve(key)
        }
      },
    )
  })

/**
 * Hachage par scrypt (node:crypto), sans dépendance : `scrypt$<coût>$<sel>$<clé>`, sel et clé en
 * base64. Le coût est gardé dans le hachage : un coût relevé plus tard n'invalide pas les anciens.
 */
export class ScryptPasswordHasher implements AdminUser.PasswordHasher {
  private readonly cost: number

  constructor(cost: number = SCRYPT_COST) {
    this.cost = cost
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH)
    const key = await derive(password, salt, this.cost)

    return `scrypt$${this.cost}$${salt.toString('base64')}$${key.toString('base64')}`
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const [algorithm, cost, salt, key] = hash.split('$')
    if (algorithm !== 'scrypt' || cost === undefined || salt === undefined || key === undefined) {
      return false
    }
    const expected = Buffer.from(key, 'base64')
    const actual = await derive(password, Buffer.from(salt, 'base64'), Number(cost))

    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
}
