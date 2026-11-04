export declare namespace LegalPage {
  interface Section {
    readonly title: string
    readonly html: string
  }

  /** HTML découpé à l'enregistrement, depuis le Markdown saisi dans l'admin (Renderer). */
  interface Entity {
    readonly slug: string
    readonly title: string
    readonly introduction: string
    readonly sections: Section[]
  }

  interface Repository {
    findBySlug(slug: string): Promise<Entity | null>
  }

  /** Saisie d'une page légale dans l'admin. Le slug ne se modifie pas. */
  interface Input {
    readonly title: string
    /** Markdown ; chaque titre de niveau 2 ouvre une section. */
    readonly body: string
  }

  /** Page légale vue par l'admin, avec son Markdown. */
  interface Editable extends Input {
    readonly slug: string
  }

  /** Lectures et écritures de l'admin sur les pages légales (ni création ni suppression). */
  interface Writer {
    findAll(): Promise<Editable[]>
    findEditable(slug: string): Promise<Editable | null>
    update(slug: string, page: Input & ReturnType<Renderer['split']>): Promise<void>
  }

  /** Markdown saisi dans l'admin, découpé en introduction et sections HTML. */
  interface Renderer {
    split(body: string): { introduction: string; sections: Section[] }
  }
}
