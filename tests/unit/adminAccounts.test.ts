import { describe, expect, it } from 'vitest'

import { InvalidEmailError, PasswordTooShortError } from '#/admin/domain/AdminUser.ts'
import { authenticate, saveAdmin } from '#/admin/application/adminAccounts.ts'
import { ScryptPasswordHasher } from '#/admin/infrastructure/scryptPasswordHasher.ts'
import { LoginThrottle, MAX_FAILURES, WINDOW_MS } from '#/admin/http/loginThrottle.ts'

import type { AdminUser } from '#/admin/domain/AdminUser.ts'

/** Coût minimal de scrypt : les tests restent rapides, l'algorithme est le même. */
const hasher = new ScryptPasswordHasher(1024)

const dependencies = () => {
  const users = new Map<string, AdminUser.Entity>()
  const adminUsers: AdminUser.Repository = {
    findByEmail: (email) => Promise.resolve(users.get(email) ?? null),
    save: (user) => {
      users.set(user.email, user)
      return Promise.resolve()
    },
  }

  return { users, dependencies: { adminUsers, passwordHasher: hasher } }
}

const PASSWORD = 'mot-de-passe-solide'

describe('saveAdmin', () => {
  it("crée le compte avec l'adresse normalisée et un mot de passe haché", async () => {
    const { users, dependencies: deps } = dependencies()

    const user = await saveAdmin(deps, '  Admin@Exemple.FR ', PASSWORD)

    expect(user.email).toBe('admin@exemple.fr')
    expect(user.passwordHash).toMatch(/^scrypt\$1024\$/)
    expect(user.passwordHash).not.toContain(PASSWORD)
    expect(users.get('admin@exemple.fr')).toEqual(user)
  })

  it('change le mot de passe d’un compte existant', async () => {
    const { users, dependencies: deps } = dependencies()
    await saveAdmin(deps, 'admin@exemple.fr', PASSWORD)

    await saveAdmin(deps, 'admin@exemple.fr', 'nouveau-mot-de-passe')

    expect(users.size).toBe(1)
    expect(await authenticate(deps, 'admin@exemple.fr', 'nouveau-mot-de-passe')).not.toBeNull()
    expect(await authenticate(deps, 'admin@exemple.fr', PASSWORD)).toBeNull()
  })

  it('refuse une adresse invalide', async () => {
    await expect(saveAdmin(dependencies().dependencies, 'admin', PASSWORD)).rejects.toThrow(
      InvalidEmailError,
    )
  })

  it('refuse un mot de passe de moins de 12 caractères, comptés en points de code', async () => {
    const deps = dependencies().dependencies

    await expect(saveAdmin(deps, 'admin@exemple.fr', 'onze-car-xx')).rejects.toThrow(
      PasswordTooShortError,
    )
    await expect(saveAdmin(deps, 'admin@exemple.fr', 'é'.repeat(12))).resolves.toBeDefined()
  })
})

describe('authenticate', () => {
  it('reconnaît le compte, quelle que soit la casse de l’adresse', async () => {
    const { dependencies: deps } = dependencies()
    await saveAdmin(deps, 'admin@exemple.fr', PASSWORD)

    expect(await authenticate(deps, 'ADMIN@exemple.fr', PASSWORD)).toMatchObject({
      email: 'admin@exemple.fr',
    })
  })

  it('refuse un mauvais mot de passe et une adresse inconnue', async () => {
    const { dependencies: deps } = dependencies()
    await saveAdmin(deps, 'admin@exemple.fr', PASSWORD)

    expect(await authenticate(deps, 'admin@exemple.fr', 'mauvais-mot-de-passe')).toBeNull()
    expect(await authenticate(deps, 'inconnu@exemple.fr', PASSWORD)).toBeNull()
  })
})

describe('ScryptPasswordHasher', () => {
  it('sale chaque hachage et refuse un hachage illisible', async () => {
    const [first, second] = [await hasher.hash(PASSWORD), await hasher.hash(PASSWORD)]

    expect(first).not.toBe(second)
    expect(await hasher.verify(PASSWORD, first)).toBe(true)
    expect(await hasher.verify(PASSWORD, 'md5$abc')).toBe(false)
  })
})

describe('LoginThrottle', () => {
  it('bloque après 5 échecs pendant le quart d’heure, puis laisse réessayer', () => {
    const throttle = new LoginThrottle()
    const start = 1_000_000
    for (let attempt = 0; attempt < MAX_FAILURES; attempt++) {
      expect(throttle.minutesBeforeRetry('a@b.fr', start)).toBe(0)
      throttle.fail('a@b.fr', start)
    }

    expect(throttle.minutesBeforeRetry('a@b.fr', start)).toBe(15)
    expect(throttle.minutesBeforeRetry('autre@b.fr', start)).toBe(0)
    expect(throttle.minutesBeforeRetry('a@b.fr', start + WINDOW_MS)).toBe(0)
  })

  it('efface les échecs après une connexion réussie', () => {
    const throttle = new LoginThrottle()
    for (let attempt = 0; attempt < MAX_FAILURES; attempt++) {
      throttle.fail('a@b.fr', 0)
    }

    throttle.reset('a@b.fr')

    expect(throttle.minutesBeforeRetry('a@b.fr', 0)).toBe(0)
  })
})
