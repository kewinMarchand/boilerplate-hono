import { z } from 'zod'

import { translationsSchema } from '#/shared/infrastructure/translations.ts'

import { COLOR_SCHEMES, DEFAULT_SITE_IDENTITY } from '#/site/domain/SiteIdentity.ts'

import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { SiteIdentity } from '#/site/domain/SiteIdentity.ts'
import type { Collection } from 'mongodb'

/** Une seule identité par API : identifiant fixé, comme SiteIdentity::ID de l'API Platform. */
const ID = 1

const HEX = /^#[0-9a-f]{6}$/

const siteIdentityDocumentSchema = z.object({
  _id: z.int(),
  name: z.string().min(1),
  tagline: z.string(),
  /** Logo (ADR 0005) : empreinte, texte de remplacement et hauteur de la plus grande variante, ou null. */
  logoKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  logoAlt: z.string(),
  logoHeight: z.int().min(1).nullable(),
  /** Couleurs saisies seulement : les jetons sont recalculés à la lecture. */
  primaryColor: z.string().regex(HEX).nullable(),
  secondaryColor: z.string().regex(HEX).nullable(),
  defaultColorScheme: z.enum(COLOR_SCHEMES),
  /** Image de partage (ADR 0010) : empreinte et texte de remplacement, ou null. */
  shareImageKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  shareImageAlt: z.string(),
  /** Icône du site (favicons, ADR 0011), décorative : empreinte seule, ou null. */
  iconKey: z
    .string()
    .regex(/^[0-9a-f]{32}$/)
    .nullable(),
  /** Vente en ligne (SPEC-COMMUNE, section 27). */
  salesEnabled: z.boolean(),
  /** Adresse qui reçoit les messages du contact, privée. */
  contactRecipient: z.string().min(1),
  /** Langues du site (ADR 0014), la langue par défaut en premier. */
  locales: z.array(z.string().regex(/^[a-z]{2}$/)).min(1),
  /** Nom et accroche dans les autres langues. */
  translations: translationsSchema(),
})

type SiteIdentityDocument = z.infer<typeof siteIdentityDocumentSchema>

export const siteIdentityCollection: CollectionDefinition<typeof siteIdentityDocumentSchema> = {
  name: 'siteIdentity',
  schema: siteIdentityDocumentSchema,
  indexes: [],
}

const toDocument = ({
  name,
  tagline,
  logo,
  colors,
  defaultColorScheme,
  shareImage,
  icon,
  salesEnabled,
  contactRecipient,
  locales,
  translations,
}: SiteIdentity.Entity): SiteIdentityDocument => ({
  _id: ID,
  name,
  tagline,
  logoKey: logo?.key ?? null,
  logoAlt: logo?.alt ?? '',
  logoHeight: logo?.height ?? null,
  primaryColor: colors?.primary ?? null,
  secondaryColor: colors?.secondary ?? null,
  defaultColorScheme,
  shareImageKey: shareImage?.key ?? null,
  shareImageAlt: shareImage?.alt ?? '',
  iconKey: icon?.key ?? null,
  salesEnabled,
  contactRecipient,
  locales: [...locales],
  translations,
})

const toEntity = (document: SiteIdentityDocument): SiteIdentity.Entity => {
  const { logoKey, logoAlt, logoHeight, primaryColor, secondaryColor, shareImageKey, iconKey } =
    document
  const [defaultLocale = DEFAULT_SITE_IDENTITY.locales[0], ...otherLocales] = document.locales
  return {
    name: document.name,
    tagline: document.tagline,
    logo:
      logoKey === null
        ? null
        : logoHeight === null
          ? { key: logoKey, alt: logoAlt }
          : { key: logoKey, alt: logoAlt, height: logoHeight },
    colors:
      primaryColor === null || secondaryColor === null
        ? null
        : { primary: primaryColor, secondary: secondaryColor },
    defaultColorScheme: document.defaultColorScheme,
    shareImage: shareImageKey === null ? null : { key: shareImageKey, alt: document.shareImageAlt },
    icon: iconKey === null ? null : { key: iconKey, alt: '' },
    salesEnabled: document.salesEnabled,
    contactRecipient: document.contactRecipient,
    locales: [defaultLocale, ...otherLocales],
    translations: document.translations,
  }
}

/** Accroche anglaise dormante (ADR 0014) : servie seulement avec X-Scenario: bilingual, comme SiteIdentityFixtures::TAGLINE_EN. */
export const TAGLINE_EN =
  'Website template with boilerplates-ui, equipped for QA and end-to-end testing.'

/** Fixture : les valeurs du modèle, sans logo, image de partage, icône ni couleurs, vente en ligne active, une seule langue, comme SiteIdentityFixtures. */
export const siteIdentityFixture: SiteIdentityDocument = toDocument({
  ...DEFAULT_SITE_IDENTITY,
  translations: { en: { tagline: TAGLINE_EN } },
})

export class MongoSiteIdentityRepository implements SiteIdentity.Repository {
  private readonly collection: Collection<SiteIdentityDocument>

  constructor(collection: Collection<SiteIdentityDocument>) {
    this.collection = collection
  }

  async find(): Promise<SiteIdentity.Entity | null> {
    const document = await this.collection.findOne({ _id: ID })
    return document === null ? null : toEntity(document)
  }

  async save(identity: SiteIdentity.Entity): Promise<void> {
    const { _id, ...fields } = toDocument(identity)
    await this.collection.updateOne({ _id }, { $set: fields }, { upsert: true })
  }
}
