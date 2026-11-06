import { z } from 'zod'

import { EXPOSURES, SIZES } from '#/catalog/domain/catalog.ts'
import { imageViewContract } from '#/media/http/imageContract.ts'

export const categoryNodeContract = z
  .object({
    slug: z.string(),
    name: z.string(),
    parent: z
      .string()
      .nullable()
      .meta({ description: 'Slug de la catégorie parente, null à la racine.' }),
    get children(): z.ZodArray<typeof categoryNodeContract> {
      return z.array(categoryNodeContract)
    },
  })
  .meta({
    id: 'Category',
    description:
      "Renvoie l'arbre des catégories : les catégories racines, chacune avec ses enfants, triées par position.",
  })

export const productItemContract = z
  .object({
    id: z.int(),
    slug: z.string(),
    name: z.string(),
    categorySlug: z.string(),
    price: z.int().meta({ description: 'Prix en centimes.' }),
    exposure: z.enum(EXPOSURES),
    size: z.enum(SIZES),
    inStock: z.boolean(),
    image: z.union([imageViewContract, z.null()]),
  })
  .meta({ id: 'ProductItem' })

export const facetValueContract = z
  .object({
    value: z.string(),
    count: z.int().meta({
      description:
        'Nombre de produits obtenus en ajoutant cette valeur aux filtres des autres facettes.',
    }),
  })
  .meta({ id: 'FacetValue' })

export const categoryFacetValueContract = z
  .object({
    slug: z.string(),
    name: z.string(),
    count: z.int().meta({
      description: 'Nombre de produits de cette sous-catégorie qui respectent les autres filtres.',
    }),
  })
  .meta({ id: 'CategoryFacetValue' })

export const productFacetsContract = z
  .object({
    exposure: z
      .array(facetValueContract)
      .meta({ description: 'Toutes les expositions, y compris à 0.' }),
    size: z.array(facetValueContract).meta({ description: 'Toutes les tailles, y compris à 0.' }),
    category: z.array(categoryFacetValueContract).meta({
      description:
        'Sous-catégories directes de la catégorie filtrée (catégories racines sans filtre). Vide sur une feuille.',
    }),
  })
  .meta({ id: 'ProductFacets' })

export const productListContract = z
  .object({
    items: z.array(productItemContract),
    totalItems: z
      .int()
      .meta({ description: 'Nombre total de produits filtrés, toutes pages confondues.' }),
    page: z.int(),
    itemsPerPage: z.int(),
    totalPages: z.int().meta({ description: 'Nombre de pages, 0 si aucun résultat.' }),
    facets: productFacetsContract,
  })
  .meta({
    id: 'ProductList',
    description:
      "Liste les produits du catalogue. Les filtres se combinent en ET, les valeurs d'une même facette en OU. Une valeur invalide (inconnue, non numérique, hors bornes) est ignorée et remplacée par la valeur par défaut.",
  })
