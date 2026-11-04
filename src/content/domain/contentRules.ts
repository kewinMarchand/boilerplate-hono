/** Règles d'écriture des contenus, mêmes messages que l'API Platform (ADR 0001 des deux dépôts). */
export const IMAGE_COUNT = 5

/** Règle des contenus refusée : le message est montré tel quel dans l'admin. */
export class ContentRuleViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContentRuleViolation'
  }
}

export const checkImage = (image: number): void => {
  if (!Number.isInteger(image) || image < 1 || image > IMAGE_COUNT) {
    throw new ContentRuleViolation(`Le visuel est un numéro de 1 à ${IMAGE_COUNT} : ${image}.`)
  }
}
