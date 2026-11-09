/**
 * Règle d'un module enfreinte (ADR 0014, comme RuleViolation de l'API Platform). Le modèle de
 * message, en français, sert aussi de clé de traduction : l'admin le traduit dans la langue de son
 * interface avec ses paramètres ; le message de l'erreur reste le texte français, paramètres remplacés.
 */
export class RuleViolation extends Error {
  // Champs privés : deux violations au même message restent égales pour les tests (toThrow)
  readonly #template: string
  readonly #parameters: Readonly<Record<string, string | number>>

  /** `template` : modèle français, paramètres en `%nom%`. */
  constructor(template: string, parameters: Readonly<Record<string, string | number>> = {}) {
    super(fillTemplate(template, parameters))
    this.name = 'RuleViolation'
    this.#template = template
    this.#parameters = parameters
  }

  get template(): string {
    return this.#template
  }

  get parameters(): Readonly<Record<string, string | number>> {
    return this.#parameters
  }
}

/** Remplace chaque `%nom%` du modèle par son paramètre. */
export const fillTemplate = (
  template: string,
  parameters: Readonly<Record<string, string | number>>,
): string =>
  Object.entries(parameters).reduce(
    (text, [name, value]) => text.replaceAll(`%${name}%`, String(value)),
    template,
  )
