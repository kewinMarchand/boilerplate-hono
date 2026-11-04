/** Comme login_throttling de l'API Platform : 5 échecs par quart d'heure, puis refus. */
export const MAX_FAILURES = 5
export const WINDOW_MS = 15 * 60 * 1000

/**
 * Échecs de connexion par adresse, en mémoire : une seule instance de l'API, et un redémarrage
 * remet les compteurs à zéro. Un succès efface les échecs de l'adresse.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, number[]>()

  private recent(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
    this.failures.set(key, kept)

    return kept
  }

  /** Minutes avant le prochain essai permis, 0 si l'adresse peut essayer. */
  minutesBeforeRetry(key: string, now: number = Date.now()): number {
    const kept = this.recent(key, now)
    const oldest = kept[0]
    if (kept.length < MAX_FAILURES || oldest === undefined) {
      return 0
    }

    return Math.ceil((WINDOW_MS - (now - oldest)) / 60_000)
  }

  fail(key: string, now: number = Date.now()): void {
    this.recent(key, now).push(now)
  }

  reset(key: string): void {
    this.failures.delete(key)
  }
}
