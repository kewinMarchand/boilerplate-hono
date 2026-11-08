/** Images envoyées par l'admin (ADR 0002 de l'API Platform), même vocabulaire que son module Media. */
export declare namespace Media {
  /**
   * Usage d'une image : il fixe le ratio du recadrage, les largeurs et les formats des variantes. Le
   * logo n'est pas recadré ; l'image de partage (share) et l'icône du site (icon) le sont.
   */
  type Usage = 'article' | 'product' | 'logo' | 'share' | 'icon'

  /**
   * Format d'une variante. Les photos sont en AVIF puis WebP, dans l'ordre où un navigateur doit les
   * essayer ; les icônes du site en PNG, que lisent tous les navigateurs et les écrans d'accueil.
   */
  type Format = 'avif' | 'webp' | 'png'

  /** Format d'un fichier audio accepté, reconnu à son contenu ; la valeur est l'extension du fichier stocké. */
  type AudioFormat = 'mp3' | 'm4a' | 'ogg'

  /**
   * Image stockée, désignée par l'empreinte de son contenu. Texte de remplacement vide : décorative.
   * Pour un usage sans recadrage (logo), la hauteur de la plus grande variante dépend du fichier : l'image la porte.
   * Une source plus étroite que la plus grande variante de son usage porte la largeur de sa plus
   * grande variante, ramenée à la sienne ; absente : la plus grande variante de l'usage.
   */
  interface Image {
    readonly key: string
    readonly alt: string
    readonly height?: number
    readonly width?: number
  }

  /** Fichier audio stocké tel qu'envoyé, désigné par l'empreinte de son contenu, avec sa durée lue à l'envoi. */
  interface Audio {
    readonly key: string
    readonly format: AudioFormat
    /** Secondes, arrondies, 1 au moins. */
    readonly durationSeconds: number
  }

  /** Ce que l'inspecteur lit d'un fichier audio envoyé : son format réel et sa durée. */
  interface SourceAudio {
    readonly format: AudioFormat
    readonly durationSeconds: number
  }

  interface AudioInspector {
    /** Format réel et durée, lus dans le contenu, ou null s'il n'est ni MP3, ni M4A (audio seul), ni OGG. */
    inspect(content: Uint8Array): SourceAudio | null
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
    /**
     * Recadre au ratio de l'usage, centré (sans recadrage pour un usage qui n'en a pas), puis encode
     * chaque largeur demandée (widthsUpTo) dans chaque format de l'usage, sans métadonnées.
     */
    variants(
      content: Uint8Array,
      key: string,
      usage: Usage,
      widths: readonly [number, ...number[]],
    ): Promise<ReadonlyMap<string, Uint8Array>>
  }

  interface Storage {
    has(fileName: string): Promise<boolean>
    put(fileName: string, content: Uint8Array): Promise<void>
  }
}
