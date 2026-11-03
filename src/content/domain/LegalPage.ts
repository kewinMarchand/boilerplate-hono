export declare namespace LegalPage {
  interface Section {
    readonly title: string
    readonly html: string
  }

  /** HTML déjà découpé par l'API Platform, qui convertit le Markdown saisi dans son admin. */
  interface Entity {
    readonly slug: string
    readonly title: string
    readonly introduction: string
    readonly sections: Section[]
  }

  interface Repository {
    findBySlug(slug: string): Promise<Entity | null>
  }
}
