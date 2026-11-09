import { RuleViolation } from '#/shared/domain/ruleViolation.ts'

declare const PRICE: unique symbol

/**
 * Prix en centimes d'euro, entier positif ou nul. Les fronts manipulent des euros : la
 * conversion se fait chez eux, l'API ne connaît que les centimes. Le type marqué interdit de
 * passer un nombre quelconque là où un prix est attendu : seul fromCents en produit un.
 */
export type Price = number & { readonly [PRICE]: true }

export class InvalidPriceError extends RuleViolation {
  constructor(cents: number) {
    super('Un prix ne peut pas être négatif ni fractionnaire : %cents% centimes.', { cents })
    this.name = 'InvalidPriceError'
  }
}

export const Price = {
  fromCents: (cents: number): Price => {
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new InvalidPriceError(cents)
    }

    // Seul point de création d'un Price : la marque n'existe qu'à la compilation, le nombre est vérifié juste au-dessus.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return cents as Price
  },
}
