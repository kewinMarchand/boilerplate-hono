import type { Price } from './price.ts'
import type { Media } from '#/media/domain/Media.ts'

export const EXPOSURES = ['soleil', 'mi-ombre', 'ombre'] as const
export const SIZES = ['S', 'M', 'L'] as const
/** Types d'un attribut configurable (section 23 de SPEC-COMMUNE, ADR 0006). */
export const ATTRIBUTE_TYPES = ['choice', 'number', 'text'] as const
export const DEFAULT_ITEMS_PER_PAGE = 12
export const MAX_ITEMS_PER_PAGE = 48
/** Borne le décalage de pagination dans les entiers sûrs : au-delà, la page est simplement vide. */
export const MAX_PAGE = 1_000_000
/** Images de la galerie d'un produit, en plus de l'image principale (ADR 0008). */
export const MAX_GALLERY_IMAGES = 8

const EXPOSURE_VALUES: readonly string[] = EXPOSURES
const SIZE_VALUES: readonly string[] = SIZES
const ATTRIBUTE_TYPE_VALUES: readonly string[] = ATTRIBUTE_TYPES

export const isExposure = (value: string): value is Catalog.Exposure =>
  EXPOSURE_VALUES.includes(value)

export const isSize = (value: string): value is Catalog.Size => SIZE_VALUES.includes(value)

export const isAttributeType = (value: string): value is Catalog.AttributeType =>
  ATTRIBUTE_TYPE_VALUES.includes(value)

export declare namespace Catalog {
  type Exposure = (typeof EXPOSURES)[number]
  type Size = (typeof SIZES)[number]
  type AttributeType = (typeof ATTRIBUTE_TYPES)[number]

  /** Valeur d'un attribut à choix : son code, porté par les produits et les filtres, et son libellé. */
  interface AttributeChoice {
    readonly value: string
    readonly label: string
  }

  /**
   * Caractéristique de produit définie dans l'admin. Le code ne change pas après la création :
   * les produits et les filtres le portent. Valeurs et filtre réservés au type « choice ».
   */
  interface ProductAttribute {
    readonly code: string
    readonly label: string
    readonly type: AttributeType
    readonly unit: string | null
    readonly filterable: boolean
    readonly position: number
    /** Dans l'ordre d'affichage. */
    readonly choices: readonly AttributeChoice[]
  }

  /** Attribut renseigné sur un produit, avec ce qu'il faut pour l'afficher. */
  interface AttributeValue {
    readonly code: string
    readonly label: string
    readonly type: AttributeType
    readonly value: string
    /** Libellé de la valeur pour une liste, la valeur elle-même sinon. */
    readonly valueLabel: string
    readonly unit: string | null
  }

  interface AttributeFacet {
    readonly code: string
    readonly label: string
    readonly values: { readonly value: string; readonly label: string; readonly count: number }[]
  }

  interface Category {
    readonly slug: string
    readonly name: string
    readonly parent: string | null
    readonly position: number
  }

  interface CategoryNode {
    readonly slug: string
    readonly name: string
    readonly parent: string | null
    readonly children: CategoryNode[]
  }

  interface Product {
    readonly id: number
    readonly slug: string
    readonly name: string
    readonly categorySlug: string
    readonly price: Price
    readonly exposure: Exposure
    readonly size: Size
    readonly inStock: boolean
    /** Image envoyée par l'admin (ADR 0002), null pour un produit d'avant l'envoi des images. */
    readonly image: Media.Image | null
    /** À la une : montré dans le carrousel de la page d'accueil. */
    readonly featured: boolean
    /** Texte brut, paragraphes séparés par une ligne vide ; vide tant que l'admin n'en a pas écrit. */
    readonly description: string
    /** Valeurs des attributs renseignés, en chaîne, par code. */
    readonly attributeValues: Readonly<Record<string, string>>
    /** Galerie : 8 images au plus, dans l'ordre d'affichage, sans l'image principale (ADR 0008). */
    readonly gallery: readonly Media.Image[]
    /** Référencement de la fiche (SPEC-COMMUNE, section 26), vide tant que l'admin n'en a pas saisi. */
    readonly metaTitle: string
    readonly metaDescription: string
  }

  /**
   * Une ligne de la galerie saisie dans l'admin : une image enregistrée (désignée par son empreinte)
   * ou une ligne d'ajout, ignorée sans fichier.
   */
  interface GalleryRowInput {
    /** Empreinte de l'image enregistrée de la ligne, null pour une ligne d'ajout. */
    readonly key: string | null
    /** Contenu du fichier envoyé : remplace l'image de la ligne, ou l'ajoute. */
    readonly content: Uint8Array | null
    /** Vide : le nom du produit. */
    readonly alt: string
    /** Ordre d'affichage, croissant ; à égalité, l'ordre des lignes. */
    readonly position: number
    readonly remove: boolean
  }

  interface FacetValue {
    readonly value: string
    readonly count: number
  }

  interface CategoryFacetValue {
    readonly slug: string
    readonly name: string
    readonly count: number
  }

  interface ProductList {
    readonly items: Product[]
    readonly totalItems: number
    readonly facets: {
      readonly exposure: FacetValue[]
      readonly size: FacetValue[]
      /** Sous-catégories directes de la catégorie filtrée, racines sans filtre, vide sur une feuille. */
      readonly category: CategoryFacetValue[]
      /** Attributs filtrables portés par au moins un produit de la branche, par position. */
      readonly attributes: AttributeFacet[]
    }
  }

  type Sort = 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'

  /** Paramètres bruts de la requête, avant application des règles « valeur invalide ignorée ». */
  interface RawCriteria {
    readonly category: string | undefined
    readonly exposure: readonly string[]
    readonly size: readonly string[]
    readonly priceMin: string | undefined
    readonly priceMax: string | undefined
    readonly inStock: string | undefined
    readonly orderPrice: string | undefined
    readonly orderName: string | undefined
    readonly page: string | undefined
    readonly itemsPerPage: string | undefined
    /** Valeurs demandées par code d'attribut (`attributes[<code>][]`). */
    readonly attributes: ReadonlyMap<string, readonly string[]>
  }

  interface Criteria {
    readonly category: string | null
    readonly exposures: readonly Exposure[]
    readonly sizes: readonly Size[]
    readonly priceMin: Price | null
    readonly priceMax: Price | null
    readonly inStockOnly: boolean
    readonly sort: Sort | null
    readonly page: number
    readonly itemsPerPage: number
    /** Codes et valeurs inconnus écartés par la recherche, qui voit les définitions. */
    readonly attributes: ReadonlyMap<string, readonly string[]>
  }

  /** Requête passée au dépôt : la branche est résolue, les sous-catégories à compter connues. */
  interface SearchQuery {
    readonly branch: string | null
    readonly children: readonly string[]
    readonly exposures: readonly Exposure[]
    readonly sizes: readonly Size[]
    readonly priceMin: Price | null
    readonly priceMax: Price | null
    readonly inStockOnly: boolean
    readonly sort: Sort | null
    readonly skip: number
    readonly limit: number
    /** Filtres d'attributs retenus : attributs filtrables, valeurs connues, en OU dans un attribut. */
    readonly attributeFilters: ReadonlyMap<string, readonly string[]>
    /** Codes des attributs filtrables à compter. */
    readonly attributeFacets: readonly string[]
  }

  interface SearchResult {
    readonly items: Product[]
    readonly totalItems: number
    readonly exposureCounts: Partial<Record<Exposure, number>>
    readonly sizeCounts: Partial<Record<Size, number>>
    readonly categoryCounts: Partial<Record<string, number>>
    /**
     * Par code d'attribut filtrable porté par au moins un produit de la branche (absent sinon) :
     * compteur de chaque valeur, avec tous les filtres sauf celui de l'attribut.
     */
    readonly attributeCounts: ReadonlyMap<string, Partial<Record<string, number>>>
  }

  interface ProductAttributeRepository {
    /** Tous les attributs, triés par position. */
    findAll(): Promise<ProductAttribute[]>
  }

  /** Écritures de l'admin sur les attributs. */
  interface ProductAttributeWriter {
    findByCode(code: string): Promise<ProductAttribute | null>
    create(attribute: ProductAttribute): Promise<void>
    update(attribute: ProductAttribute): Promise<void>
    remove(code: string): Promise<void>
  }

  /** Saisie d'un attribut dans l'admin ; les lignes de valeurs vides sont écartées par le cas d'usage. */
  interface ProductAttributeInput {
    readonly code: string
    readonly label: string
    readonly type: AttributeType
    readonly unit: string
    readonly filterable: boolean
    readonly position: number
    readonly choices: readonly AttributeChoice[]
  }

  interface CategoryRepository {
    /** Toutes les catégories, triées par position. */
    findAll(): Promise<Category[]>
  }

  interface ProductRepository {
    search(query: SearchQuery): Promise<SearchResult>
    findBySlug(slug: string): Promise<Product | null>
    /** Produits à la une, par nom. */
    findFeatured(): Promise<Product[]>
  }

  /** Saisie d'un produit dans l'admin, prix déjà vérifié. */
  interface ProductInput {
    readonly slug: string
    readonly name: string
    readonly categorySlug: string
    readonly price: Price
    readonly exposure: Exposure
    readonly size: Size
    readonly inStock: boolean
    readonly featured: boolean
    readonly description: string
    /** Contenu du fichier envoyé, null pour garder l'image actuelle. */
    readonly imageContent: Uint8Array | null
    /** Vide (et non décorative) : le nom du produit. */
    readonly imageAlt: string
    readonly imageDecorative: boolean
    /** Valeur saisie par code d'attribut, vide quand il n'est pas renseigné. */
    readonly attributeValues: Readonly<Record<string, string>>
    /** Images de la galerie, puis lignes d'ajout. */
    readonly gallery: readonly GalleryRowInput[]
    readonly metaTitle: string
    readonly metaDescription: string
  }

  /** Produit enregistré par l'admin, image résolue. */
  interface ProductSaved {
    readonly slug: string
    readonly name: string
    readonly categorySlug: string
    readonly price: Price
    readonly exposure: Exposure
    readonly size: Size
    readonly inStock: boolean
    readonly featured: boolean
    readonly description: string
    readonly image: Media.Image
    readonly attributeValues: Readonly<Record<string, string>>
    readonly gallery: readonly Media.Image[]
    readonly metaTitle: string
    readonly metaDescription: string
  }

  /** Écritures de l'admin sur les catégories. */
  interface CategoryWriter {
    create(category: Category): Promise<void>
    /** Remplace la catégorie `previousSlug` ; ses sous-catégories suivent un changement de slug. */
    update(previousSlug: string, category: Category): Promise<void>
    remove(slug: string): Promise<void>
  }

  /** Lectures et écritures de l'admin sur les produits. */
  interface ProductWriter {
    findById(id: number): Promise<Product | null>
    findBySlug(slug: string): Promise<Product | null>
    /** Tous les produits, par catégorie puis par nom : liste de l'admin. */
    findAll(): Promise<Product[]>
    countInCategory(slug: string): Promise<number>
    create(product: ProductSaved, categoryPath: readonly string[]): Promise<Product>
    update(id: number, product: ProductSaved, categoryPath: readonly string[]): Promise<void>
    remove(id: number): Promise<void>
    /** Produits rangés dans `previousSlug` : leur catégorie devient `slug`, avec son chemin. */
    moveCategory(previousSlug: string, slug: string, categoryPath: readonly string[]): Promise<void>
    /** Retire la valeur de l'attribut `code` de tous les produits. */
    removeAttributeValue(code: string): Promise<void>
  }
}
