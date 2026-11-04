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

  /** Saisie d'une diapositive dans l'admin. */
  interface Input {
    readonly slug: string
    readonly title: string
    readonly text: string
    readonly image: number
    /** Ordre dans le carrousel, du plus petit au plus grand. */
    readonly position: number
  }

  /** Diapositive vue par l'admin, avec sa position. */
  interface Editable extends Input {
    readonly id: number
  }

  /** Lectures et écritures de l'admin sur les diapositives. */
  interface Writer {
    findAll(): Promise<Editable[]>
    findById(id: number): Promise<Editable | null>
    findBySlug(slug: string): Promise<Editable | null>
    create(input: Input): Promise<Editable>
    update(id: number, input: Input): Promise<void>
    remove(id: number): Promise<void>
  }
}
