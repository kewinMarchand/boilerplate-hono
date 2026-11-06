/** Images envoyées par l'admin (ADR 0002 de l'API Platform), même vocabulaire que son module Media. */
export declare namespace Media {
  /** Usage d'une image : il fixe le ratio du recadrage et les largeurs des variantes. */
  type Usage = 'slide' | 'article' | 'product'

  /** Format d'une variante, dans l'ordre où un navigateur doit les essayer. */
  type Format = 'avif' | 'webp'

  /** Image stockée, désignée par l'empreinte de son contenu. Texte de remplacement vide : décorative. */
  interface Image {
    readonly key: string
    readonly alt: string
  }

  /** Ce que l'encodeur lit d'un fichier envoyé : son type réel et ses dimensions, orientation EXIF appliquée. */
  interface Source {
    readonly mimeType: string
    readonly width: number
    readonly height: number
  }

  /** Fichier envoyé par l'admin (ou importé par les fixtures), avec son texte de remplacement. */
  interface Upload {
    readonly content: Uint8Array
    readonly alt: string
    readonly decorative: boolean
  }

  interface Encoder {
    /** Type réel et dimensions du fichier, ou null s'il ne se lit pas comme une image. */
    inspect(content: Uint8Array): Promise<Source | null>
    /** Recadre au ratio de l'usage, centré, puis encode chaque largeur dans chaque format, sans métadonnées. */
    variants(
      content: Uint8Array,
      key: string,
      usage: Usage,
    ): Promise<ReadonlyMap<string, Uint8Array>>
  }

  interface Storage {
    has(fileName: string): Promise<boolean>
    put(fileName: string, content: Uint8Array): Promise<void>
  }
}
