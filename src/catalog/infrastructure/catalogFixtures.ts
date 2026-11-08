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

/** Attributs de démonstration (section 23 de SPEC-COMMUNE), comme dans l'API Platform. */
export const productAttributeFixtures: Catalog.ProductAttribute[] = [
  {
    code: 'feuillage',
    label: 'Feuillage',
    type: 'choice',
    unit: null,
    filterable: true,
    position: 1,
    choices: [
      { value: 'persistant', label: 'Persistant' },
      { value: 'caduc', label: 'Caduc' },
    ],
  },
  {
    code: 'hauteur-adulte',
    label: 'Hauteur adulte',
    type: 'number',
    unit: 'cm',
    filterable: false,
    position: 2,
    choices: [],
  },
]

/** Attributs renseignés, par slug : feuillage (liste filtrable) et hauteur adulte (nombre, en cm). */
const ATTRIBUTE_VALUES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'monstera-deliciosa': { feuillage: 'persistant', 'hauteur-adulte': '300' },
  'monstera-adansonii': { feuillage: 'persistant' },
  'fougere-de-boston': { feuillage: 'persistant' },
  'fougere-arborescente-dicksonia': { 'hauteur-adulte': '500' },
  'strelitzia-nicolai': { feuillage: 'persistant', 'hauteur-adulte': '600' },
  'palmier-de-chine': { feuillage: 'persistant', 'hauteur-adulte': '1200' },
  'palmier-bleu-du-mexique': { feuillage: 'persistant' },
  'palmier-nain': { 'hauteur-adulte': '250' },
  'nenuphar-blanc-rustique': { feuillage: 'caduc' },
  'lotus-sacre': { feuillage: 'caduc', 'hauteur-adulte': '150' },
}

/** Description de chaque produit, par slug, comme dans l'API Platform. */
const DESCRIPTIONS: Readonly<Record<string, string>> = {
  'monstera-deliciosa':
    'Grandes feuilles vert profond, découpées et perforées avec l’âge : le monstera deliciosa habille une pièce à lui seul.\n\nLumière vive sans soleil direct, arrosage quand le terreau a séché sur deux centimètres. Un tuteur en mousse l’aide à grimper.',
  'monstera-adansonii':
    'Feuillage léger, percé de nombreux trous ovales. Ce petit monstera retombe joliment d’une suspension ou grimpe le long d’un tuteur.\n\nIl aime l’humidité : vaporisez ses feuilles en période de chauffage.',
  'monstera-thai-constellation':
    'Variété rare au feuillage moucheté de crème, chaque feuille est unique. Sa croissance est lente et sa panachure stable.\n\nLumière vive indispensable pour garder les taches claires, arrosage modéré.',
  'fougere-de-boston':
    'Frondes arquées d’un vert tendre, en touffe généreuse. La fougère de Boston aime les pièces lumineuses et humides, comme une salle de bains.\n\nGardez le terreau frais, sans excès d’eau.',
  'asplenium-nidus':
    'Ses feuilles entières et brillantes s’ouvrent en rosette, comme un nid d’oiseau. Une fougère facile qui tolère la mi-ombre.\n\nArrosez autour du cœur, jamais dedans.',
  'fougere-arborescente-dicksonia':
    'Un tronc fibreux surmonté d’une couronne de frondes : la silhouette d’une forêt primitive pour un patio abrité.\n\nArrosez le tronc lui-même en été, il absorbe l’eau. Protégez la couronne du gel.',
  'anthurium-andreanum-rouge':
    'Spathes rouge vif, brillantes comme laquées, qui durent plusieurs semaines. L’anthurium fleurit presque toute l’année en intérieur.\n\nLumière vive sans soleil direct, terreau léger juste humide.',
  'anthurium-clarinervium':
    'Feuilles en cœur, épaisses et veloutées, parcourues de nervures argentées. Un anthurium de collection, cultivé pour son feuillage.\n\nAtmosphère humide et arrosage doux, à l’eau non calcaire.',
  'anthurium-blanc-champion':
    'Spathes blanc pur, élégantes et sobres, au-dessus d’un feuillage vert brillant. Une floraison longue pour une pièce claire.\n\nÉvitez les courants d’air et le soleil de midi.',
  'strelitzia-reginae':
    'Ses fleurs orange et bleu évoquent la tête d’un oiseau exotique. Le strelitzia reginae fleurit après quelques années, au soleil.\n\nArrosage régulier en été, plus rare en hiver. Sortez-le au jardin aux beaux jours.',
  'strelitzia-nicolai':
    'Grandes feuilles en éventail, façon bananier : le strelitzia nicolai donne de la hauteur à un salon lumineux.\n\nPlein soleil ou lumière très vive, arrosage quand le terreau a séché en surface.',
  'strelitzia-reginae-jeune-plant':
    'Jeune plant d’oiseau de paradis, à faire grandir. Comptez trois à cinq ans avant les premières fleurs.\n\nRempotez-le au printemps dans un pot à peine plus grand.',
  'palmier-de-chine':
    'Palmier rustique jusqu’à −15 °C, aux palmes en éventail portées par un stipe couvert de fibres. Il pousse en pleine terre comme en grand bac.\n\nSoleil ou mi-ombre, sol drainé.',
  'palmier-bleu-du-mexique':
    'Palmes argent-bleuté, très graphiques. Le brahea armata supporte la sécheresse et le froid sec une fois installé.\n\nPlein soleil, sol caillouteux, arrosages rares.',
  'palmier-nain':
    'Seul palmier originaire d’Europe, le palmier nain forme une touffe compacte, idéale en pot sur une terrasse ensoleillée.\n\nIl résiste au vent, aux embruns et à la sécheresse.',
  'heliconia-rostrata':
    'Bractées rouges bordées de jaune, en cascade pendante : l’heliconia rostrata, ou pince de homard, est la fleur des jardins tropicaux.\n\nChaleur, soleil et arrosage généreux en saison.',
  'heliconia-psittacorum':
    'Petites bractées orange et rouge, dressées comme des becs de perroquet. Une floraison abondante en massif ou en pot.\n\nSoleil, sol riche et humide.',
  'heliconia-wagneriana':
    'Bractées rose corail ourlées de vert et de jaune, alternées sur la hampe. L’une des heliconias les plus spectaculaires.\n\nMi-ombre lumineuse, chaleur et humidité constantes.',
  'calliandra-haematocephala':
    'Pompons rouges soyeux, faits d’étamines, sur un feuillage fin et léger. Un arbuste qui attire les colibris sous les tropiques.\n\nSoleil, taille légère après la floraison.',
  'calliandra-surinamensis':
    'Pompons bicolores blancs à pointe rose, en floraison presque continue. Ce calliandra reste compact et convient au pot.\n\nSoleil et arrosage régulier.',
  'calliandra-tweedii':
    'Houppes rouge vif sur un feuillage plumeux. Le calliandra tweedii supporte un peu de fraîcheur et forme un bel arbuste isolé.\n\nSoleil, sol bien drainé.',
  'nenuphar-blanc-rustique':
    'Fleurs blanches parfumées, posées sur de grandes feuilles rondes. Ce nénuphar indigène passe l’hiver au fond du bassin.\n\nPlantez-le en panier, entre 50 cm et 1 m de profondeur.',
  'nenuphar-bleu-du-nil':
    'Fleurs bleu ciel étoilées, ouvertes le matin et refermées l’après-midi. Le nénuphar sacré de l’Égypte ancienne.\n\nEau chaude et plein soleil ; rentrez-le à l’abri du gel.',
  'lotus-sacre':
    'Fleurs roses dressées au-dessus de l’eau, puis capsules de graines décoratives. Ses grandes feuilles déperlantes restent sèches sous la pluie.\n\nBassin peu profond, plein soleil et chaleur.',
}

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
    description: DESCRIPTIONS[slug] ?? '',
    attributeValues: ATTRIBUTE_VALUES[slug] ?? {},
    demoImage: `product-${(index % 12) + 1}`,
  }),
)
