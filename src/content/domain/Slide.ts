export declare namespace Slide {
  interface Entity {
    readonly id: number
    readonly slug: string
    readonly title: string
    readonly text: string
    /** Numéro du visuel livré avec les fronts, de 1 à 5. */
    readonly image: number
  }

  interface Repository {
    findInOrder(): Promise<Entity[]>
  }
}
