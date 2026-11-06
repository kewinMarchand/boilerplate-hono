/** Règle des contenus refusée : le message est montré tel quel dans l'admin (ADR 0001 des deux dépôts). */
export class ContentRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentRuleViolation'
  }
}
