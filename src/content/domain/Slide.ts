import type { Media } from '#/media/domain/Media.ts'

export declare namespace Slide {
  interface Entity {
    readonly id: number
    readonly slug: string
    readonly title: string
    readonly text: string
    /** Image envoyée par l'admin (ADR 0002), null pour une diapositive d'avant l'envoi des images. */
    readonly image: Media.Image | null
  }

  interface Repository {
    findInOrder(): Promise<Entity[]>
  }

  /** Saisie d'une diapositive dans l'admin. */
  interface Input {
    readonly slug: string
    readonly title: string
    readonly text: string
    /** Ordre dans le carrousel, du plus petit au plus grand. */
    readonly position: number
    /** Contenu du fichier envoyé, null pour garder l'image actuelle. */
    readonly imageContent: Uint8Array | null
    readonly imageAlt: string
    readonly imageDecorative: boolean
  }

  /** Diapositive enregistrée par l'admin, image résolue. */
  interface Saved {
    readonly slug: string
    readonly title: string
    readonly text: string
    readonly position: number
    readonly image: Media.Image
  }

  /** Diapositive vue par l'admin, avec sa position. */
  interface Editable extends Entity {
    readonly position: number
  }

  /** Lectures et écritures de l'admin sur les diapositives. */
  interface Writer {
    findAll(): Promise<Editable[]>
    findById(id: number): Promise<Editable | null>
    findBySlug(slug: string): Promise<Editable | null>
    create(slide: Saved): Promise<Editable>
    update(id: number, slide: Saved): Promise<void>
    remove(id: number): Promise<void>
  }
}
