import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import type { Article } from '#/blog/domain/Article.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const articleDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  excerpt: z.string(),
  publishedAt: z.date(),
  /** Empreinte de l'image envoyée par l'admin (ADR 0002), null pour un article d'avant l'envoi des images. */
  imageKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  imageAlt: z.string(),
  /** Markdown saisi dans l'admin, et son HTML converti à l'enregistrement (markdownArticle). */
  body: z.string(),
  html: z.string(),
})

type ArticleDocument = z.infer<typeof articleDocumentSchema>

/** Fixture : l'illustration de démonstration (fixtures/images), décorative, importée par resetDatabase. */
export type ArticleFixture = Omit<ArticleDocument, 'imageKey' | 'imageAlt' | 'html'> & {
  readonly demoImage: string
}

export const articleCollection: CollectionDefinition<typeof articleDocumentSchema> = {
  name: 'articles',
  schema: articleDocumentSchema,
  indexes: [{ key: { slug: 1 }, unique: true }, { key: { publishedAt: -1, _id: -1 } }],
}

export const articleFixtures: ArticleFixture[] = [
  {
    _id: 1,
    slug: 'pourquoi-rendre-le-contenu-cote-serveur',
    title: 'Pourquoi rendre le contenu côté serveur',
    excerpt: 'Le contenu éditorial arrive dans le HTML initial : meilleur référencement et LCP.',
    publishedAt: new Date('2026-09-15T00:00:00Z'),
    demoImage: 'blog-1',
    body: 'Une page dont le texte n’arrive qu’après l’exécution du JavaScript reste vide pour un moteur de recherche pressé, et pour le visiteur dont le téléphone est lent. Rendre le contenu sur le serveur, c’est envoyer une page déjà lisible.\n\n## Ce que le visiteur gagne\n\nLe premier affichage contient le titre, le texte et les images. Le navigateur peut commencer à peindre la page sans attendre le moindre script, et l’image la plus grande, celle que mesure le *Largest Contentful Paint*, est découverte dès la lecture du HTML.\n\n- le texte est lisible même si un script échoue ;\n- les liens fonctionnent avant l’hydratation ;\n- le référencement voit la même page que le visiteur.\n\n## Ce qu’il reste au navigateur\n\nLe JavaScript n’ajoute que ce qui demande une interaction : un carrousel qu’on fait glisser, des filtres appliqués sans recharger la page. Sans lui, la page reste utilisable : c’est l’amélioration progressive.',
  },
  {
    _id: 2,
    slug: 'un-carrousel-accessible-sans-dependance',
    title: 'Un carrousel accessible sans dépendance',
    excerpt: 'Défilement natif, boutons explicites, pas de lecture automatique.',
    publishedAt: new Date('2026-09-22T00:00:00Z'),
    demoImage: 'blog-2',
    body: 'Un carrousel est souvent le composant le moins accessible d’une page d’accueil : défilement automatique impossible à arrêter, boutons sans nom, diapositives annoncées dans le désordre. Il peut pourtant rester simple.\n\n## Partir du défilement natif\n\nSans JavaScript, la piste défile au doigt, à la molette ou au clavier grâce à `overflow-x: auto` et à l’accrochage `scroll-snap`. Le script ne fait qu’ajouter le glisser à la souris et les boutons.\n\n## Nommer chaque élément\n\n- les boutons Précédent et Suivant disent ce qu’ils font, et se désactivent aux extrémités ;\n- chaque diapositive est un groupe annoncé « 2 sur 5 » ;\n- les points de pagination indiquent la diapositive courante.\n\nEnfin, pas de lecture automatique : c’est le visiteur qui décide du rythme, et l’animation se coupe quand il demande moins de mouvement.',
  },
  {
    _id: 3,
    slug: 'le-mode-accessibilite-renforcee',
    title: 'Le mode accessibilité renforcée',
    excerpt: 'Texte agrandi, espacements WCAG 1.4.12 et contraste AAA, sans logique dupliquée.',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
    demoImage: 'blog-3',
    body: 'Le mode accessibilité renforcée agrandit le texte, élargit les espacements et pousse les contrastes au niveau AAA, d’un seul clic, sans recharger la page.\n\n## Un seul thème, des jetons redéfinis\n\nAucun second thème n’est maintenu à côté du premier. Le bouton pose un attribut sur l’élément racine, et les jetons de la charte (couleurs, tailles du texte, épaisseur du focus) prennent leurs valeurs renforcées sous cet attribut. Les composants ne changent pas.\n\n## Ce que le mode applique\n\n- les espacements du critère WCAG 1.4.12 sur le texte de contenu ;\n- des couleurs qui atteignent un contraste de 7:1 ;\n- un indicateur de focus plus épais.\n\nLe choix est gardé dans le navigateur et appliqué avant le premier affichage : la page ne clignote pas d’un mode à l’autre.',
  },
]

const toArticle = ({
  _id,
  slug,
  title,
  excerpt,
  publishedAt,
  imageKey,
  imageAlt,
  body,
  html,
}: ArticleDocument): Article.Entity => ({
  id: _id,
  slug,
  title,
  excerpt,
  publishedAt: publishedAt.toISOString().slice(0, 10),
  image: imageKey === null ? null : { key: imageKey, alt: imageAlt },
  body,
  html,
})

/** Champs dans l'ordre des fixtures, que suit le JSON de l'API. */
const toDocument = ({ slug, title, excerpt, publishedAt, image, body, html }: Article.Saved) => ({
  slug,
  title,
  excerpt,
  publishedAt: new Date(`${publishedAt}T00:00:00Z`),
  imageKey: image.key,
  imageAlt: image.alt,
  body,
  html,
})

export class MongoArticleRepository implements Article.Repository, Article.Writer {
  private readonly collection: Collection<ArticleDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(collection: Collection<ArticleDocument>, counters: Collection<CounterDocument>) {
    this.collection = collection
    this.counters = counters
  }

  async findById(id: number): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toArticle(document)
  }

  async findBySlug(slug: string): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ slug })
    return document === null ? null : toArticle(document)
  }

  async create(input: Article.Saved): Promise<Article.Entity> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, articleCollection.name, last?._id ?? 0)
    const document: ArticleDocument = { _id: id, ...toDocument(input) }
    await this.collection.insertOne(document)

    return toArticle(document)
  }

  async update(id: number, input: Article.Saved): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: toDocument(input) })
  }

  async remove(id: number): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }

  async findLatestFirst(): Promise<Article.Entity[]> {
    const documents = await this.collection
      .find({}, { sort: { publishedAt: -1, _id: -1 } })
      .toArray()

    return documents.map(toArticle)
  }
}
