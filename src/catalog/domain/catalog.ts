import type { Price } from './price.ts'

export const EXPOSURES = ['soleil', 'mi-ombre', 'ombre'] as const
export const SIZES = ['S', 'M', 'L'] as const
export const DEFAULT_ITEMS_PER_PAGE = 12
export const MAX_ITEMS_PER_PAGE = 48
/** Borne le décalage de pagination dans les entiers sûrs : au-delà, la page est simplement vide. */
export const MAX_PAGE = 1_000_000

const EXPOSURE_VALUES: readonly string[] = EXPOSURES
const SIZE_VALUES: readonly string[] = SIZES

export const isExposure = (value: string): value is Catalog.Exposure =>
  EXPOSURE_VALUES.includes(value)

export const isSize = (value: string): value is Catalog.Size => SIZE_VALUES.includes(value)

export declare namespace Catalog {
  type Exposure = (typeof EXPOSURES)[number]
  type Size = (typeof SIZES)[number]

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
    /** Index du visuel partagé, de 1 à 12. */
    readonly image: number
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
    readonly page: number
    readonly itemsPerPage: number
    /** 0 si aucun résultat. */
    readonly totalPages: number
    readonly facets: {
      readonly exposure: FacetValue[]
      readonly size: FacetValue[]
      /** Sous-catégories directes de la catégorie filtrée, racines sans filtre, vide sur une feuille. */
      readonly category: CategoryFacetValue[]
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
  }

  interface SearchResult {
    readonly items: Product[]
    readonly totalItems: number
    readonly exposureCounts: Partial<Record<Exposure, number>>
    readonly sizeCounts: Partial<Record<Size, number>>
    readonly categoryCounts: Partial<Record<string, number>>
  }

  interface CategoryRepository {
    /** Toutes les catégories, triées par position. */
    findAll(): Promise<Category[]>
  }

  interface ProductRepository {
    search(query: SearchQuery): Promise<SearchResult>
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
    readonly image: number
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
    create(input: ProductInput, categoryPath: readonly string[]): Promise<Product>
    update(id: number, input: ProductInput, categoryPath: readonly string[]): Promise<void>
    remove(id: number): Promise<void>
    /** Produits rangés dans `previousSlug` : leur catégorie devient `slug`, avec son chemin. */
    moveCategory(previousSlug: string, slug: string, categoryPath: readonly string[]): Promise<void>
  }
}
