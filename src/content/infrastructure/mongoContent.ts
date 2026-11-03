import { z } from 'zod'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type { Slide } from '#/content/domain/Slide.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const slideDocumentSchema = z.object({
  _id: z.int().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  text: z.string(),
  image: z.int().min(1).max(5),
  position: z.int(),
})

const legalPageDocumentSchema = z.object({
  _id: z.string().min(1),
  title: z.string().min(1),
  introduction: z.string(),
  sections: z.array(z.object({ title: z.string(), html: z.string() })),
})

type SlideDocument = z.infer<typeof slideDocumentSchema>
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

export const slideFixtures: SlideDocument[] = [
  {
    _id: 1,
    slug: 'heliconia',
    title: 'Heliconia',
    text: 'Des bractées rouges et jaunes en pinces de homard, qui tiennent des semaines au jardin.',
    image: 1,
    position: 1,
  },
  {
    _id: 2,
    slug: 'anthurium',
    title: 'Anthurium',
    text: 'Une spathe vernissée qui fleurit presque toute l’année à la lumière vive d’un intérieur.',
    image: 2,
    position: 2,
  },
  {
    _id: 3,
    slug: 'calliandra',
    title: 'Calliandra',
    text: 'Des pompons d’étamines rouges qui attirent colibris et papillons en lisière de jardin.',
    image: 3,
    position: 3,
  },
  {
    _id: 4,
    slug: 'strelitzia',
    title: 'Strelitzia',
    text: 'L’oiseau de paradis, sa fleur orange et bleue et ses grandes feuilles en éventail.',
    image: 4,
    position: 4,
  },
  {
    _id: 5,
    slug: 'nenuphar',
    title: 'Nénuphar',
    text: 'Des fleurs qui s’ouvrent au matin à la surface du bassin et se referment le soir.',
    image: 5,
    position: 5,
  },
]

/** HTML recopié de la réponse de l'API Platform (fixtures Doctrine converties par son admin). */
export const legalPageFixtures: LegalPageDocument[] = [
  {
    _id: 'mentions-legales',
    title: 'Mentions légales',
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
        html: "<p>L'ensemble des contenus de ce site (textes, images, code) est la propriété de Exemple SAS (société fictive), sauf mention contraire. Toute reproduction sans autorisation écrite préalable est interdite.</p>",
      },
    ],
  },
  {
    _id: 'donnees-personnelles',
    title: 'Données personnelles',
    introduction: '',
    sections: [
      {
        title: 'Responsable de traitement',
        html: '<p>Exemple SAS (société fictive), 1 rue de l’Exemple, 13000 Marseille.</p>',
      },
      {
        title: 'Finalité et base légale',
        html: "<p>Le formulaire de contact collecte votre nom, votre adresse e-mail et votre message, dans le seul but de vous répondre. Ce traitement repose sur votre consentement, exprimé par l'envoi du formulaire.</p>",
      },
      {
        title: 'Durée de conservation',
        html: '<p>Les messages sont conservés trois ans à compter du dernier échange, puis supprimés.</p>',
      },
      {
        title: 'Vos droits',
        html: '<p>Vous disposez sur vos données des droits suivants :</p>\n<ul>\n<li>accès ;</li>\n<li>rectification ;</li>\n<li>effacement ;</li>\n<li>opposition.</li>\n</ul>\n<p>Pour les exercer, écrivez à <a href="mailto:contact@example.com">contact@example.com</a>. Si la réponse ne vous satisfait pas, vous pouvez adresser une réclamation à la <a href="https://www.cnil.fr/fr/plaintes">Commission nationale de l\'informatique et des libertés (CNIL)</a>.</p>',
      },
      {
        title: 'Cookies et stockage local',
        html: "<p>Ce site ne dépose aucun cookie de mesure d'audience. Seule votre préférence pour le mode accessibilité renforcée est enregistrée dans votre navigateur, sans jamais nous être transmise.</p>",
      },
    ],
  },
  {
    _id: 'accessibilite',
    title: "Déclaration d'accessibilité",
    introduction:
      "<p>Exemple SAS (société fictive) s'engage à rendre ce site accessible conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005. Cette déclaration s'applique à ce site.</p>",
    sections: [
      {
        title: 'État de conformité',
        html: "<p>Ce site est <strong>non conforme</strong> avec le référentiel général d'amélioration de l'accessibilité (RGAA), version 4.1.2.</p>\n<p>Aucun audit n'a encore été réalisé.</p>",
      },
      {
        title: 'Résultats des tests',
        html: "<p>Tests automatisés axe-core uniquement (règles WCAG 2.1 A et AA), sur chaque page, sur ordinateur et mobile, dans les deux modes d'affichage. Ils ne couvrent qu'une partie des critères du RGAA et ne valent pas audit.</p>",
      },
      { title: 'Contenus non accessibles', html: '<p>À compléter après audit.</p>' },
      {
        title: 'Mode accessibilité renforcée',
        html: "<p>Le bouton « Accessibilité renforcée » de l'en-tête agrandit le texte, augmente les espacements et le contraste, souligne les liens, épaissit l'indicateur de focus et coupe les animations. Le choix est mémorisé dans votre navigateur.</p>",
      },
      {
        title: 'Environnement de test',
        html: '<ul>\n<li>Chromium (Playwright), affichage ordinateur et mobile ;</li>\n<li>axe-core, via @axe-core/playwright ;</li>\n<li>Lighthouse CI.</li>\n</ul>',
      },
      {
        title: "Retour d'information et contact",
        html: '<p>Si vous ne parvenez pas à accéder à un contenu ou à un service, écrivez à <a href="mailto:contact@example.com">contact@example.com</a> pour être orienté vers une alternative accessible ou obtenir le contenu sous une autre forme.</p>',
      },
      {
        title: 'Voies de recours',
        html: '<p>Si vous avez signalé un défaut d\'accessibilité sans obtenir de réponse satisfaisante, vous pouvez saisir le <a href="https://formulaire.defenseurdesdroits.fr/">Défenseur des droits</a> par le formulaire en ligne, contacter un délégué dans votre région ou écrire, sans affranchissement, à : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</p>',
      },
    ],
  },
]

export class MongoSlideRepository implements Slide.Repository {
  private readonly collection: Collection<SlideDocument>

  constructor(collection: Collection<SlideDocument>) {
    this.collection = collection
  }

  async findInOrder(): Promise<Slide.Entity[]> {
    const documents = await this.collection.find({}, { sort: { position: 1, _id: 1 } }).toArray()

    return documents.map(({ _id, position, ...slide }) => ({ id: _id, ...slide }))
  }
}

export class MongoLegalPageRepository implements LegalPage.Repository {
  private readonly collection: Collection<LegalPageDocument>

  constructor(collection: Collection<LegalPageDocument>) {
    this.collection = collection
  }

  async findBySlug(slug: string): Promise<LegalPage.Entity | null> {
    const document = await this.collection.findOne({ _id: slug })
    if (document === null) {
      return null
    }
    const { _id, ...page } = document

    return { slug: _id, ...page }
  }
}
