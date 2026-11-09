import { RuleViolation } from '#/shared/domain/ruleViolation.ts'

/** Règle des contenus refusée : le message s'affiche dans l'admin, traduit dans la langue de son interface (ADR 0001 et 0014). */
export class ContentRuleViolation extends RuleViolation {
  constructor(template: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(template, parameters)
    this.name = 'ContentRuleViolation'
  }
}
