import { z } from 'zod'

import { ATTRIBUTE_TYPES, EXPOSURES, SIZES } from '#/catalog/domain/catalog.ts'
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

export const attributeValueContract = z
  .object({
    code: z.string(),
    label: z.string(),
    type: z.enum(ATTRIBUTE_TYPES),
    value: z.string().meta({
      description: 'Valeur en chaîne : code de la valeur pour choice, nombre ou texte sinon.',
    }),
    valueLabel: z
      .string()
      .meta({ description: 'Libellé de la valeur pour choice, la valeur elle-même sinon.' }),
    unit: z
      .string()
      .nullable()
      .meta({ description: "Unité (« cm », « km »), null si l'attribut n'en a pas." }),
  })
  .meta({ id: 'AttributeValue' })

const productItemShape = {
  id: z.int(),
  slug: z.string(),
  name: z.string(),
  categorySlug: z.string(),
  price: z.int().meta({ description: 'Prix en centimes.' }),
  exposure: z.enum(EXPOSURES),
  size: z.enum(SIZES),
  inStock: z.boolean(),
  image: z.union([imageViewContract, z.null()]),
  attributes: z.array(attributeValueContract).meta({
    description:
      'Attributs configurables renseignés sur le produit, par position ; tableau vide si aucun.',
  }),
}

export const productContract = z.object(productItemShape).meta({
  id: 'Product',
  description:
    "Liste une page de produits. Les filtres se combinent en ET, les valeurs d'une même facette en OU. Une valeur invalide (inconnue, non numérique, hors bornes) est ignorée et remplacée par la valeur par défaut. Le total et les compteurs de facettes : GET /api/product-facets avec les mêmes filtres.",
})

export const categoryLinkContract = z
  .object({ slug: z.string(), name: z.string() })
  .meta({ id: 'CategoryLink' })

export const productDetailContract = z
  .object({
    ...productItemShape,
    categoryPath: z.array(categoryLinkContract).meta({
      description: "Catégories de la racine à celle du produit, pour le fil d'Ariane.",
    }),
    description: z.string().meta({
      description:
        "Texte brut, paragraphes séparés par une ligne vide ; chaîne vide si l'admin n'en a pas écrit.",
    }),
    gallery: z.array(imageViewContract).meta({
      description:
        "Images de la galerie (carrées, 8 au plus), dans l'ordre, sans l'image principale ; tableau vide si aucune.",
    }),
    metaTitle: z.string().meta({
      description:
        "Titre pour les moteurs de recherche, 60 caractères au plus ; chaîne vide si l'admin n'en a pas saisi.",
    }),
    metaDescription: z.string().meta({
      description:
        "Description pour les moteurs de recherche, 160 caractères au plus ; chaîne vide si l'admin n'en a pas saisi.",
    }),
  })
  .meta({ id: 'ProductDetail', description: 'Lit un produit par son slug.' })

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

export const attributeFacetValueContract = z
  .object({
    value: z.string(),
    label: z.string(),
    count: z.int().meta({
      description:
        'Nombre de produits obtenus en ajoutant cette valeur aux filtres des autres facettes et des autres attributs.',
    }),
  })
  .meta({ id: 'AttributeFacetValue' })

export const attributeFacetContract = z
  .object({
    code: z
      .string()
      .meta({ description: "Code de l'attribut, clé du filtre attributes[<code>][]." }),
    label: z.string(),
    values: z.array(attributeFacetValueContract).meta({
      description: "Toutes les valeurs de l'attribut, dans leur ordre, y compris à 0.",
    }),
  })
  .meta({ id: 'AttributeFacet' })

export const productFacetsContract = z
  .object({
    totalItems: z
      .int()
      .meta({ description: 'Nombre de produits filtrés, toutes pages confondues.' }),
    exposure: z
      .array(facetValueContract)
      .meta({ description: 'Toutes les expositions, y compris à 0.' }),
    size: z.array(facetValueContract).meta({ description: 'Toutes les tailles, y compris à 0.' }),
    category: z.array(categoryFacetValueContract).meta({
      description:
        'Sous-catégories directes de la catégorie filtrée (catégories racines sans filtre). Vide sur une feuille.',
    }),
    attributes: z.array(attributeFacetContract).meta({
      description:
        'Attributs filtrables portés par au moins un produit de la branche de catégorie, par position.',
    }),
  })
  .meta({
    id: 'ProductFacets',
    description:
      'Compte les produits filtrés, au total et par valeur de facette. Mêmes filtres que GET /api/products, sans tri ni pagination.',
  })
