import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import { SPEAKER_MAX_LENGTH, TERM_KINDS } from '#/blog/domain/Article.ts'
import { AUDIO_FORMATS } from '#/media/domain/audioRules.ts'

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
  /** Rubrique et format (ADR 0009) : identifiants de la collection articleTerms, ou null. */
  sectionId: z.int().min(1).nullable(),
  formatId: z.int().min(1).nullable(),
  /** Fichier audio (ADR 0009) : empreinte, format et durée arrondie, ou null. */
  audioKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  audioFormat: z.enum(AUDIO_FORMATS).nullable(),
  audioDuration: z.int().min(0).nullable(),
  speaker: z.string().max(SPEAKER_MAX_LENGTH),
  /** Référencement de la fiche (SPEC-COMMUNE, section 26). */
  metaTitle: z.string(),
  metaDescription: z.string(),
})

/** Rubrique ou format : identifiant entier (compteur), slug unique dans sa sorte. */
const articleTermDocumentSchema = z.object({
  _id: z.int().min(1),
  kind: z.enum(TERM_KINDS),
  slug: z.string().min(1),
  name: z.string().min(1),
  position: z.int().min(0),
})

type ArticleDocument = z.infer<typeof articleDocumentSchema>
type ArticleTermDocument = z.infer<typeof articleTermDocumentSchema>

/**
 * Fixture : l'illustration de démonstration (fixtures/images), décorative, et le fichier audio de
 * démonstration (fixtures/audio) ou null, importés par resetDatabase.
 */
export type ArticleFixture = Omit<
  ArticleDocument,
  'imageKey' | 'imageAlt' | 'html' | 'audioKey' | 'audioFormat' | 'audioDuration'
> & {
  readonly demoImage: string
  readonly demoAudio: string | null
}

export const articleCollection: CollectionDefinition<typeof articleDocumentSchema> = {
  name: 'articles',
  schema: articleDocumentSchema,
  indexes: [{ key: { slug: 1 }, unique: true }, { key: { publishedAt: -1, _id: -1 } }],
}

export const articleTermCollection: CollectionDefinition<typeof articleTermDocumentSchema> = {
  name: 'articleTerms',
  schema: articleTermDocumentSchema,
  indexes: [{ key: { kind: 1, slug: 1 }, unique: true }, { key: { kind: 1, position: 1 } }],
}

/** Deux rubriques et un format, comme ArticleFixtures de l'API Platform. */
export const articleTermFixtures: ArticleTermDocument[] = [
  { _id: 1, kind: 'section', slug: 'conseils', name: 'Conseils', position: 1 },
  { _id: 2, kind: 'section', slug: 'actualites', name: 'Actualités', position: 2 },
  { _id: 3, kind: 'format', slug: 'guide', name: 'Guide', position: 1 },
]

export const articleFixtures: ArticleFixture[] = [
  {
    _id: 1,
    slug: 'pourquoi-rendre-le-contenu-cote-serveur',
    title: 'Pourquoi rendre le contenu côté serveur',
    excerpt: 'Le contenu éditorial arrive dans le HTML initial : meilleur référencement et LCP.',
    publishedAt: new Date('2026-09-15T00:00:00Z'),
    demoImage: 'blog-1',
    demoAudio: null,
    sectionId: 1,
    formatId: 3,
    speaker: '',
    metaTitle: '',
    metaDescription: '',
    body: 'Une page dont le texte n’arrive qu’après l’exécution du JavaScript reste vide pour un moteur de recherche pressé, et pour le visiteur dont le téléphone est lent. Rendre le contenu sur le serveur, c’est envoyer une page déjà lisible.\n\n## Ce que le visiteur gagne\n\nLe premier affichage contient le titre, le texte et les images. Le navigateur peut commencer à peindre la page sans attendre le moindre script, et l’image la plus grande, celle que mesure le *Largest Contentful Paint*, est découverte dès la lecture du HTML.\n\n- le texte est lisible même si un script échoue ;\n- les liens fonctionnent avant l’hydratation ;\n- le référencement voit la même page que le visiteur.\n\n## Ce qu’il reste au navigateur\n\nLe JavaScript n’ajoute que ce qui demande une interaction : un carrousel qu’on fait glisser, des filtres appliqués sans recharger la page. Sans lui, la page reste utilisable : c’est l’amélioration progressive.',
  },
  {
    _id: 2,
    slug: 'un-carrousel-accessible-sans-dependance',
    title: 'Un carrousel accessible sans dépendance',
    excerpt: 'Défilement natif, boutons explicites, pas de lecture automatique.',
    publishedAt: new Date('2026-09-22T00:00:00Z'),
    demoImage: 'blog-2',
    demoAudio: 'article-demo',
    sectionId: 1,
    formatId: null,
    speaker: 'Présenté par Hina Teriierooiterai',
    metaTitle: '',
    metaDescription: '',
    body: 'Un carrousel est souvent le composant le moins accessible d’une page d’accueil : défilement automatique impossible à arrêter, boutons sans nom, diapositives annoncées dans le désordre. Il peut pourtant rester simple.\n\n## Partir du défilement natif\n\nSans JavaScript, la piste défile au doigt, à la molette ou au clavier grâce à `overflow-x: auto` et à l’accrochage `scroll-snap`. Le script ne fait qu’ajouter le glisser à la souris et les boutons.\n\n## Nommer chaque élément\n\n- les boutons Précédent et Suivant disent ce qu’ils font, et se désactivent aux extrémités ;\n- chaque diapositive est un groupe annoncé « 2 sur 5 » ;\n- les points de pagination indiquent la diapositive courante.\n\nEnfin, pas de lecture automatique : c’est le visiteur qui décide du rythme, et l’animation se coupe quand il demande moins de mouvement.',
  },
  {
    _id: 3,
    slug: 'le-mode-accessibilite-renforcee',
    title: 'Le mode accessibilité renforcée',
    excerpt: 'Texte agrandi, espacements WCAG 1.4.12 et contraste AAA, sans logique dupliquée.',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
    demoImage: 'blog-3',
    demoAudio: null,
    sectionId: 2,
    formatId: null,
    speaker: '',
    metaTitle: '',
    metaDescription: '',
    body: 'Le mode accessibilité renforcée agrandit le texte, élargit les espacements et pousse les contrastes au niveau AAA, d’un seul clic, sans recharger la page.\n\n## Un seul thème, des jetons redéfinis\n\nAucun second thème n’est maintenu à côté du premier. Le bouton pose un attribut sur l’élément racine, et les jetons de la charte (couleurs, tailles du texte, épaisseur du focus) prennent leurs valeurs renforcées sous cet attribut. Les composants ne changent pas.\n\n## Ce que le mode applique\n\n- les espacements du critère WCAG 1.4.12 sur le texte de contenu ;\n- des couleurs qui atteignent un contraste de 7:1 ;\n- un indicateur de focus plus épais.\n\nLe choix est gardé dans le navigateur et appliqué avant le premier affichage : la page ne clignote pas d’un mode à l’autre.',
  },
]

const toTerm = ({ _id, ...term }: ArticleTermDocument): Article.Term => ({ id: _id, ...term })

/** Article lu, avec ses termes résolus (`terms` : rubriques et formats, par identifiant). */
const toArticle = (
  {
    _id,
    slug,
    title,
    excerpt,
    publishedAt,
    imageKey,
    imageAlt,
    body,
    html,
    sectionId,
    formatId,
    audioKey,
    audioFormat,
    audioDuration,
    speaker,
    metaTitle,
    metaDescription,
  }: ArticleDocument,
  terms: ReadonlyMap<number, Article.Term>,
): Article.Entity => ({
  id: _id,
  slug,
  title,
  excerpt,
  publishedAt: publishedAt.toISOString().slice(0, 10),
  image: imageKey === null ? null : { key: imageKey, alt: imageAlt },
  body,
  html,
  section: sectionId === null ? null : (terms.get(sectionId) ?? null),
  format: formatId === null ? null : (terms.get(formatId) ?? null),
  audio:
    audioKey === null || audioFormat === null || audioDuration === null
      ? null
      : { key: audioKey, format: audioFormat, durationSeconds: audioDuration },
  speaker,
  metaTitle,
  metaDescription,
})

/** Champs dans l'ordre des fixtures, que suit le JSON de l'API. */
const toDocument = ({
  slug,
  title,
  excerpt,
  publishedAt,
  image,
  body,
  html,
  sectionId,
  formatId,
  audio,
  speaker,
  metaTitle,
  metaDescription,
}: Article.Saved) => ({
  slug,
  title,
  excerpt,
  publishedAt: new Date(`${publishedAt}T00:00:00Z`),
  imageKey: image.key,
  imageAlt: image.alt,
  body,
  html,
  sectionId,
  formatId,
  audioKey: audio?.key ?? null,
  audioFormat: audio?.format ?? null,
  audioDuration: audio?.durationSeconds ?? null,
  speaker,
  metaTitle,
  metaDescription,
})

export class MongoArticleTermRepository implements Article.TermRepository {
  private readonly collection: Collection<ArticleTermDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(collection: Collection<ArticleTermDocument>, counters: Collection<CounterDocument>) {
    this.collection = collection
    this.counters = counters
  }

  async findByKind(kind: Article.TermKind): Promise<Article.Term[]> {
    const documents = await this.collection
      .find({ kind }, { sort: { position: 1, name: 1 }, collation: { locale: 'fr' } })
      .toArray()
    return documents.map(toTerm)
  }

  async findById(id: number): Promise<Article.Term | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toTerm(document)
  }

  async findBySlug(kind: Article.TermKind, slug: string): Promise<Article.Term | null> {
    const document = await this.collection.findOne({ kind, slug })
    return document === null ? null : toTerm(document)
  }

  /** Toutes les rubriques et tous les formats, par identifiant : de quoi résoudre ceux des articles. */
  async byId(): Promise<Map<number, Article.Term>> {
    const documents = await this.collection.find().toArray()
    return new Map(documents.map((document) => [document._id, toTerm(document)]))
  }

  async create(kind: Article.TermKind, term: Article.TermInput): Promise<Article.Term> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, articleTermCollection.name, last?._id ?? 0)
    const document: ArticleTermDocument = { _id: id, kind, ...term }
    await this.collection.insertOne(document)
    return toTerm(document)
  }

  async update(id: number, term: Article.TermInput): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: term })
  }

  async remove(id: number): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }
}

export class MongoArticleRepository implements Article.Repository, Article.Writer {
  private readonly collection: Collection<ArticleDocument>
  private readonly counters: Collection<CounterDocument>
  private readonly terms: MongoArticleTermRepository

  constructor(
    collection: Collection<ArticleDocument>,
    counters: Collection<CounterDocument>,
    terms: MongoArticleTermRepository,
  ) {
    this.collection = collection
    this.counters = counters
    this.terms = terms
  }

  async findById(id: number): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toArticle(document, await this.terms.byId())
  }

  async findBySlug(slug: string): Promise<Article.Entity | null> {
    const document = await this.collection.findOne({ slug })
    return document === null ? null : toArticle(document, await this.terms.byId())
  }

  async create(input: Article.Saved): Promise<Article.Entity> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, articleCollection.name, last?._id ?? 0)
    const document: ArticleDocument = { _id: id, ...toDocument(input) }
    await this.collection.insertOne(document)

    return toArticle(document, await this.terms.byId())
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
    const terms = await this.terms.byId()

    return documents.map((document) => toArticle(document, terms))
  }
}
