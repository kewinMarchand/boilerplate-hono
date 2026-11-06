import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'
import type { Media } from '#/media/domain/Media.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const slideDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  /** Empreinte de l'image envoyée par l'admin (ADR 0002), null pour une diapositive d'avant l'envoi des images. */
  imageKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  imageAlt: z.string(),
  position: z.int(),
})

const legalPageDocumentSchema = z.object({
  _id: z.string().min(1),
  title: z.string().min(1),
  /** Markdown saisi dans l'admin ; introduction et sections en sont le rendu. */
  body: z.string().min(1),
  introduction: z.string(),
  sections: z.array(z.object({ title: z.string(), html: z.string() })),
})

type SlideDocument = z.infer<typeof slideDocumentSchema>

/** Fixture : la photo de démonstration (fixtures/images) et son texte, importés par resetDatabase. */
export type SlideFixture = Omit<SlideDocument, 'imageKey' | 'imageAlt'> & {
  readonly demoImage: string
  readonly alt: string
}
type LegalPageDocument = z.infer<typeof legalPageDocumentSchema>

export const slideCollection: CollectionDefinition<typeof slideDocumentSchema> = {
  name: 'slides',
  schema: slideDocumentSchema,
  indexes: [{ key: { slug: 1 }, unique: true }, { key: { position: 1, _id: 1 } }],
}

/** Le slug sert d'identifiant, comme pour les catégories. */
export const legalPageCollection: CollectionDefinition<typeof legalPageDocumentSchema> = {
  name: 'legalPages',
  schema: legalPageDocumentSchema,
  indexes: [],
}

export const slideFixtures: SlideFixture[] = [
  {
    _id: 1,
    slug: 'heliconia',
    title: 'Heliconia',
    text: 'Des bractées rouges et jaunes en pinces de homard, qui tiennent des semaines au jardin.',
    demoImage: 'slide-1',
    alt: 'Bractées rouges et jaunes d’un heliconia, en gros plan',
    position: 1,
  },
  {
    _id: 2,
    slug: 'anthurium',
    title: 'Anthurium',
    text: 'Une spathe vernissée qui fleurit presque toute l’année à la lumière vive d’un intérieur.',
    demoImage: 'slide-2',
    alt: 'Spathe rouge et brillante d’un anthurium',
    position: 2,
  },
  {
    _id: 3,
    slug: 'calliandra',
    title: 'Calliandra',
    text: 'Des pompons d’étamines rouges qui attirent colibris et papillons en lisière de jardin.',
    demoImage: 'slide-3',
    alt: 'Pompon d’étamines rouges d’un calliandra',
    position: 3,
  },
  {
    _id: 4,
    slug: 'strelitzia',
    title: 'Strelitzia',
    text: 'L’oiseau de paradis, sa fleur orange et bleue et ses grandes feuilles en éventail.',
    demoImage: 'slide-4',
    alt: 'Fleur orange et bleue d’un strelitzia',
    position: 4,
  },
  {
    _id: 5,
    slug: 'nenuphar',
    title: 'Nénuphar',
    text: 'Des fleurs qui s’ouvrent au matin à la surface du bassin et se referment le soir.',
    demoImage: 'slide-5',
    alt: 'Fleur de nénuphar ouverte sur l’eau d’un bassin',
    position: 5,
  },
]

/** HTML recopié de la réponse de l'API Platform (fixtures Doctrine converties par son admin). */
export const legalPageFixtures: LegalPageDocument[] = [
  {
    _id: 'mentions-legales',
    title: 'Mentions légales',
    body: "Les informations ci-dessous sont des valeurs d'exemple, fictives, à remplacer depuis l'administration.\n\n## Éditeur\n\nExemple SAS (société fictive), 1 rue de l’Exemple, 13000 Marseille. SIRET : 000 000 000 00000.\n\nContact : [contact@example.com](mailto:contact@example.com)\n\n## Directeur de la publication\n\nCamille Exemple\n\n## Hébergeur\n\nHébergeur Exemple, 2 avenue de l’Exemple, 75000 Paris.\n\n## Propriété intellectuelle\n\nL'ensemble des contenus de ce site (textes, images, code) est la propriété de Exemple SAS (société fictive), sauf mention contraire. Toute reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable est interdite.",
    introduction:
      "<p>Les informations ci-dessous sont des valeurs d'exemple, fictives, à remplacer depuis l'administration.</p>",
    sections: [
      {
        title: 'Éditeur',
        html: '<p>Exemple SAS (société fictive), 1 rue de l’Exemple, 13000 Marseille. SIRET : 000 000 000 00000.</p>\n<p>Contact : <a href="mailto:contact@example.com">contact@example.com</a></p>',
      },
      { title: 'Directeur de la publication', html: '<p>Camille Exemple</p>' },
      { title: 'Hébergeur', html: '<p>Hébergeur Exemple, 2 avenue de l’Exemple, 75000 Paris.</p>' },
      {
        title: 'Propriété intellectuelle',
        html: "<p>L'ensemble des contenus de ce site (textes, images, code) est la propriété de Exemple SAS (société fictive), sauf mention contraire. Toute reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable est interdite.</p>",
      },
    ],
  },
  {
    _id: 'donnees-personnelles',
    title: 'Données personnelles',
    body: "## Responsable de traitement\n\nExemple SAS (société fictive), 1 rue de l’Exemple, 13000 Marseille, représentée par Camille Exemple. Contact : [contact@example.com](mailto:contact@example.com).\n\n## Finalité\n\nLe formulaire de contact collecte votre nom, votre adresse e-mail et votre message, dans le seul but de vous répondre. Ces données ne sont ni cédées ni utilisées à des fins commerciales.\n\n## Base légale\n\nLe traitement repose sur l'intérêt légitime de l'éditeur à répondre aux demandes qui lui sont adressées (article 6.1.f du RGPD).\n\n## Durée de conservation\n\nLes messages sont conservés trois ans au plus à compter du dernier échange, puis supprimés.\n\n## Vos droits\n\nVous disposez sur vos données des droits suivants :\n\n- accès ;\n- rectification ;\n- effacement ;\n- opposition ;\n- limitation du traitement.\n\nPour les exercer, écrivez à [contact@example.com](mailto:contact@example.com). Nous répondons dans un délai d'un mois.\n\n## Réclamation\n\nSi vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la [Commission nationale de l'informatique et des libertés (CNIL)](https://www.cnil.fr/fr/plaintes).\n\n## Cookies et stockage local\n\nCe site ne dépose aucun cookie de mesure d'audience ni de publicité. Vos préférences d'affichage (mode accessibilité renforcée, thème clair ou sombre) sont enregistrées dans votre navigateur, sans jamais nous être transmises, jusqu'à ce que vous les changiez. Un cookie technique de session, exempté de consentement, peut être posé après l'envoi du formulaire de contact sans JavaScript, pour afficher la confirmation.",
    introduction: '',
    sections: [
      {
        title: 'Responsable de traitement',
        html: '<p>Exemple SAS (société fictive), 1 rue de l’Exemple, 13000 Marseille, représentée par Camille Exemple. Contact : <a href="mailto:contact@example.com">contact@example.com</a>.</p>',
      },
      {
        title: 'Finalité',
        html: '<p>Le formulaire de contact collecte votre nom, votre adresse e-mail et votre message, dans le seul but de vous répondre. Ces données ne sont ni cédées ni utilisées à des fins commerciales.</p>',
      },
      {
        title: 'Base légale',
        html: "<p>Le traitement repose sur l'intérêt légitime de l'éditeur à répondre aux demandes qui lui sont adressées (article 6.1.f du RGPD).</p>",
      },
      {
        title: 'Durée de conservation',
        html: '<p>Les messages sont conservés trois ans au plus à compter du dernier échange, puis supprimés.</p>',
      },
      {
        title: 'Vos droits',
        html: '<p>Vous disposez sur vos données des droits suivants :</p>\n<ul>\n<li>accès ;</li>\n<li>rectification ;</li>\n<li>effacement ;</li>\n<li>opposition ;</li>\n<li>limitation du traitement.</li>\n</ul>\n<p>Pour les exercer, écrivez à <a href="mailto:contact@example.com">contact@example.com</a>. Nous répondons dans un délai d\'un mois.</p>',
      },
      {
        title: 'Réclamation',
        html: '<p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la <a href="https://www.cnil.fr/fr/plaintes">Commission nationale de l\'informatique et des libertés (CNIL)</a>.</p>',
      },
      {
        title: 'Cookies et stockage local',
        html: "<p>Ce site ne dépose aucun cookie de mesure d'audience ni de publicité. Vos préférences d'affichage (mode accessibilité renforcée, thème clair ou sombre) sont enregistrées dans votre navigateur, sans jamais nous être transmises, jusqu'à ce que vous les changiez. Un cookie technique de session, exempté de consentement, peut être posé après l'envoi du formulaire de contact sans JavaScript, pour afficher la confirmation.</p>",
      },
    ],
  },
  {
    _id: 'accessibilite',
    title: "Déclaration d'accessibilité",
    body: "Exemple SAS (société fictive) s'engage à rendre ce site accessible conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration s'applique à ce site.\n\n## État de conformité\n\nCe site est **non conforme** avec le référentiel général d'amélioration de l'accessibilité (RGAA), version 4.1.2.\n\nAucun audit n'a encore été réalisé.\n\n## Résultats des tests\n\nSeuls des tests automatisés ont été réalisés, avec axe-core (règles WCAG 2.1 niveaux A et AA), sur toutes les pages, en affichage ordinateur et mobile, en mode standard et en mode accessibilité renforcée. Ces tests ne valent pas audit : ils ne couvrent qu'une partie des critères du RGAA.\n\n## Contenus non accessibles\n\nÀ compléter après audit.\n\n## Mode accessibilité renforcée\n\nLe bouton « Accessibilité renforcée » de l'en-tête agrandit le texte, augmente les espacements et le contraste, souligne les liens, épaissit l'indicateur de focus et coupe les animations. Le choix est mémorisé dans votre navigateur.\n\n## Établissement de cette déclaration\n\nDate : à compléter après audit.\n\nTechnologies utilisées : HTML, CSS, JavaScript.\n\n## Environnement de test\n\n- Chromium piloté par Playwright, affichage ordinateur (1280 × 720) ;\n- Chromium piloté par Playwright, émulation mobile (Pixel 7) ;\n- outils : axe-core (via @axe-core/playwright) et Lighthouse CI.\n\nPages testées :\n\n- [Accueil](/) ;\n- [Tâches](/taches) ;\n- [Contact](/contact) ;\n- [Catalogue](/catalogue) ;\n- [Mentions légales](/mentions-legales) ;\n- [Données personnelles](/donnees-personnelles) ;\n- [Déclaration d'accessibilité](/accessibilite) ;\n- [Plan du site](/plan-du-site).\n\n## Retour d'information et contact\n\nSi vous ne parvenez pas à accéder à un contenu ou à un service, écrivez à [contact@example.com](mailto:contact@example.com) ou passez par le [formulaire de contact](/contact) pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme.\n\n## Voies de recours\n\nSi vous avez signalé un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un service sans obtenir de réponse satisfaisante, vous pouvez :\n\n- écrire un message au [Défenseur des droits](https://formulaire.defenseurdesdroits.fr/) ;\n- contacter le délégué du Défenseur des droits dans votre région ;\n- envoyer un courrier par la poste, sans affranchissement : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.",
    introduction:
      "<p>Exemple SAS (société fictive) s'engage à rendre ce site accessible conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration s'applique à ce site.</p>",
    sections: [
      {
        title: 'État de conformité',
        html: "<p>Ce site est <strong>non conforme</strong> avec le référentiel général d'amélioration de l'accessibilité (RGAA), version 4.1.2.</p>\n<p>Aucun audit n'a encore été réalisé.</p>",
      },
      {
        title: 'Résultats des tests',
        html: "<p>Seuls des tests automatisés ont été réalisés, avec axe-core (règles WCAG 2.1 niveaux A et AA), sur toutes les pages, en affichage ordinateur et mobile, en mode standard et en mode accessibilité renforcée. Ces tests ne valent pas audit : ils ne couvrent qu'une partie des critères du RGAA.</p>",
      },
      { title: 'Contenus non accessibles', html: '<p>À compléter après audit.</p>' },
      {
        title: 'Mode accessibilité renforcée',
        html: "<p>Le bouton « Accessibilité renforcée » de l'en-tête agrandit le texte, augmente les espacements et le contraste, souligne les liens, épaissit l'indicateur de focus et coupe les animations. Le choix est mémorisé dans votre navigateur.</p>",
      },
      {
        title: 'Établissement de cette déclaration',
        html: '<p>Date : à compléter après audit.</p>\n<p>Technologies utilisées : HTML, CSS, JavaScript.</p>',
      },
      {
        title: 'Environnement de test',
        html: '<ul>\n<li>Chromium piloté par Playwright, affichage ordinateur (1280 × 720) ;</li>\n<li>Chromium piloté par Playwright, émulation mobile (Pixel 7) ;</li>\n<li>outils : axe-core (via @axe-core/playwright) et Lighthouse CI.</li>\n</ul>\n<p>Pages testées :</p>\n<ul>\n<li><a href="/">Accueil</a> ;</li>\n<li><a href="/taches">Tâches</a> ;</li>\n<li><a href="/contact">Contact</a> ;</li>\n<li><a href="/catalogue">Catalogue</a> ;</li>\n<li><a href="/mentions-legales">Mentions légales</a> ;</li>\n<li><a href="/donnees-personnelles">Données personnelles</a> ;</li>\n<li><a href="/accessibilite">Déclaration d\'accessibilité</a> ;</li>\n<li><a href="/plan-du-site">Plan du site</a>.</li>\n</ul>',
      },
      {
        title: "Retour d'information et contact",
        html: '<p>Si vous ne parvenez pas à accéder à un contenu ou à un service, écrivez à <a href="mailto:contact@example.com">contact@example.com</a> ou passez par le <a href="/contact">formulaire de contact</a> pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme.</p>',
      },
      {
        title: 'Voies de recours',
        html: '<p>Si vous avez signalé un défaut d\'accessibilité qui vous empêche d\'accéder à un contenu ou à un service sans obtenir de réponse satisfaisante, vous pouvez :</p>\n<ul>\n<li>écrire un message au <a href="https://formulaire.defenseurdesdroits.fr/">Défenseur des droits</a> ;</li>\n<li>contacter le délégué du Défenseur des droits dans votre région ;</li>\n<li>envoyer un courrier par la poste, sans affranchissement : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>\n</ul>',
      },
    ],
  },
]

const imageOf = ({ imageKey, imageAlt }: SlideDocument): Media.Image | null =>
  imageKey === null ? null : { key: imageKey, alt: imageAlt }

const toEditableSlide = (document: SlideDocument): Slide.Editable => {
  const { _id, slug, title, text, position } = document
  return { id: _id, slug, title, text, position, image: imageOf(document) }
}

const toDocumentFields = ({ slug, title, text, position, image }: Slide.Saved) => ({
  slug,
  title,
  text,
  position,
  imageKey: image.key,
  imageAlt: image.alt,
})

export class MongoSlideRepository implements Slide.Repository, Slide.Writer {
  private readonly collection: Collection<SlideDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(collection: Collection<SlideDocument>, counters: Collection<CounterDocument>) {
    this.collection = collection
    this.counters = counters
  }

  async findInOrder(): Promise<Slide.Entity[]> {
    const documents = await this.collection.find({}, { sort: { position: 1, _id: 1 } }).toArray()

    return documents.map((document) => {
      const { id, slug, title, text, image } = toEditableSlide(document)
      return { id, slug, title, text, image }
    })
  }

  async findAll(): Promise<Slide.Editable[]> {
    const documents = await this.collection.find({}, { sort: { position: 1, _id: 1 } }).toArray()

    return documents.map(toEditableSlide)
  }

  async findById(id: number): Promise<Slide.Editable | null> {
    const document = await this.collection.findOne({ _id: id })
    return document === null ? null : toEditableSlide(document)
  }

  async findBySlug(slug: string): Promise<Slide.Editable | null> {
    const document = await this.collection.findOne({ slug })
    return document === null ? null : toEditableSlide(document)
  }

  async create(slide: Slide.Saved): Promise<Slide.Editable> {
    const [last] = await this.collection.find({}, { sort: { _id: -1 }, limit: 1 }).toArray()
    const id = await nextSequence(this.counters, slideCollection.name, last?._id ?? 0)
    const document: SlideDocument = { _id: id, ...toDocumentFields(slide) }
    await this.collection.insertOne(document)

    return toEditableSlide(document)
  }

  async update(id: number, slide: Slide.Saved): Promise<void> {
    await this.collection.updateOne({ _id: id }, { $set: toDocumentFields(slide) })
  }

  async remove(id: number): Promise<void> {
    await this.collection.deleteOne({ _id: id })
  }
}

export class MongoLegalPageRepository implements LegalPage.Repository, LegalPage.Writer {
  private readonly collection: Collection<LegalPageDocument>

  constructor(collection: Collection<LegalPageDocument>) {
    this.collection = collection
  }

  async findBySlug(slug: string): Promise<LegalPage.Entity | null> {
    const document = await this.collection.findOne({ _id: slug })
    if (document === null) {
      return null
    }
    const { _id, body, ...page } = document

    return { slug: _id, ...page }
  }

  async findAll(): Promise<LegalPage.Editable[]> {
    const documents = await this.collection
      .find({}, { projection: { title: 1, body: 1 }, sort: { title: 1 } })
      .toArray()

    return documents.map(({ _id, title, body }) => ({ slug: _id, title, body }))
  }

  async findEditable(slug: string): Promise<LegalPage.Editable | null> {
    const document = await this.collection.findOne({ _id: slug })
    return document === null
      ? null
      : { slug: document._id, title: document.title, body: document.body }
  }

  async update(
    slug: string,
    page: LegalPage.Input & ReturnType<LegalPage.Renderer['split']>,
  ): Promise<void> {
    await this.collection.updateOne({ _id: slug }, { $set: page })
  }
}
