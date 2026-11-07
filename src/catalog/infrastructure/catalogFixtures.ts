import { Price } from '#/catalog/domain/price.ts'

import type { Catalog } from '#/catalog/domain/catalog.ts'

type CategoryRow = readonly [slug: string, name: string, parent: string | null]

const CATEGORIES: readonly CategoryRow[] = [
  ['plantes-interieur', 'Plantes d’intérieur', null],
  ['feuillages', 'Feuillages', 'plantes-interieur'],
  ['monstera', 'Monstera', 'feuillages'],
  ['fougeres', 'Fougères', 'feuillages'],
  ['plantes-a-fleurs', 'Plantes à fleurs', 'plantes-interieur'],
  ['anthurium', 'Anthurium', 'plantes-a-fleurs'],
  ['strelitzia', 'Strelitzia', 'plantes-a-fleurs'],
  ['plantes-exterieur', 'Plantes d’extérieur', null],
  ['palmiers', 'Palmiers', 'plantes-exterieur'],
  ['arbustes-a-fleurs', 'Arbustes à fleurs', 'plantes-exterieur'],
  ['heliconia', 'Heliconia', 'arbustes-a-fleurs'],
  ['calliandra', 'Calliandra', 'arbustes-a-fleurs'],
  ['plantes-aquatiques', 'Plantes aquatiques', null],
  ['nenuphars', 'Nénuphars', 'plantes-aquatiques'],
]

type ProductRow = readonly [
  slug: string,
  name: string,
  categorySlug: string,
  price: number,
  exposure: Catalog.Exposure,
  size: Catalog.Size,
  inStock: boolean,
]

const PRODUCTS: readonly ProductRow[] = [
  ['monstera-deliciosa', 'Monstera deliciosa', 'monstera', 3490, 'mi-ombre', 'M', true],
  ['monstera-adansonii', 'Monstera adansonii', 'monstera', 1990, 'mi-ombre', 'S', true],
  [
    'monstera-thai-constellation',
    'Monstera Thai Constellation',
    'monstera',
    12900,
    'mi-ombre',
    'L',
    false,
  ],
  ['fougere-de-boston', 'Fougère de Boston', 'fougeres', 1590, 'ombre', 'M', true],
  ['asplenium-nidus', 'Asplenium nidus', 'fougeres', 1290, 'ombre', 'S', true],
  [
    'fougere-arborescente-dicksonia',
    'Fougère arborescente Dicksonia',
    'fougeres',
    8900,
    'mi-ombre',
    'L',
    true,
  ],
  [
    'anthurium-andreanum-rouge',
    'Anthurium andreanum rouge',
    'anthurium',
    2490,
    'mi-ombre',
    'M',
    true,
  ],
  ['anthurium-clarinervium', 'Anthurium clarinervium', 'anthurium', 3990, 'ombre', 'S', false],
  [
    'anthurium-blanc-champion',
    'Anthurium blanc Champion',
    'anthurium',
    2690,
    'mi-ombre',
    'M',
    true,
  ],
  [
    'strelitzia-reginae',
    'Strelitzia reginae, oiseau de paradis',
    'strelitzia',
    4990,
    'soleil',
    'L',
    true,
  ],
  ['strelitzia-nicolai', 'Strelitzia nicolai', 'strelitzia', 6990, 'soleil', 'L', true],
  [
    'strelitzia-reginae-jeune-plant',
    'Strelitzia reginae, jeune plant',
    'strelitzia',
    1890,
    'soleil',
    'S',
    true,
  ],
  [
    'palmier-de-chine',
    'Palmier de Chine (Trachycarpus fortunei)',
    'palmiers',
    7990,
    'soleil',
    'L',
    true,
  ],
  [
    'palmier-bleu-du-mexique',
    'Palmier bleu du Mexique (Brahea armata)',
    'palmiers',
    8990,
    'soleil',
    'M',
    true,
  ],
  ['palmier-nain', 'Palmier nain (Chamaerops humilis)', 'palmiers', 4490, 'soleil', 'M', false],
  ['heliconia-rostrata', 'Heliconia rostrata', 'heliconia', 5490, 'soleil', 'L', true],
  ['heliconia-psittacorum', 'Heliconia psittacorum', 'heliconia', 2990, 'soleil', 'M', true],
  ['heliconia-wagneriana', 'Heliconia wagneriana', 'heliconia', 5990, 'mi-ombre', 'L', false],
  [
    'calliandra-haematocephala',
    'Calliandra haematocephala',
    'calliandra',
    3490,
    'soleil',
    'M',
    true,
  ],
  ['calliandra-surinamensis', 'Calliandra surinamensis', 'calliandra', 2290, 'soleil', 'S', true],
  ['calliandra-tweedii', 'Calliandra tweedii', 'calliandra', 4790, 'soleil', 'L', true],
  [
    'nenuphar-blanc-rustique',
    'Nénuphar blanc rustique (Nymphaea alba)',
    'nenuphars',
    1490,
    'soleil',
    'S',
    true,
  ],
  [
    'nenuphar-bleu-du-nil',
    'Nénuphar bleu du Nil (Nymphaea caerulea)',
    'nenuphars',
    2490,
    'soleil',
    'M',
    true,
  ],
  ['lotus-sacre', 'Lotus sacré (Nelumbo nucifera)', 'nenuphars', 3990, 'soleil', 'L', false],
]

export const categoryFixtures: Catalog.Category[] = CATEGORIES.map(
  ([slug, name, parent], index) => ({
    slug,
    name,
    parent,
    position: index + 1,
  }),
)

/** Produits du carrousel de la page d'accueil, comme dans l'API Platform. */
const FEATURED: readonly string[] = [
  'heliconia-rostrata',
  'anthurium-andreanum-rouge',
  'calliandra-haematocephala',
  'strelitzia-reginae',
  'nenuphar-bleu-du-nil',
]

/** Fixture : la photo de démonstration (fixtures/images), importée par resetDatabase avec le nom pour texte. */
export type ProductFixture = Omit<Catalog.Product, 'image'> & { readonly demoImage: string }

export const productFixtures: ProductFixture[] = PRODUCTS.map(
  ([slug, name, categorySlug, price, exposure, size, inStock], index) => ({
    id: index + 1,
    slug,
    name,
    categorySlug,
    price: Price.fromCents(price),
    exposure,
    size,
    inStock,
    featured: FEATURED.includes(slug),
    demoImage: `product-${(index % 12) + 1}`,
  }),
)
