import { z } from 'zod'

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
})

const toEntity = (document: SiteIdentityDocument): SiteIdentity.Entity => {
  const { logoKey, logoAlt, logoHeight, primaryColor, secondaryColor } = document
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
  }
}

/** Fixture : les valeurs du modèle, sans logo ni couleurs, comme SiteIdentityFixtures. */
export const siteIdentityFixture: SiteIdentityDocument = toDocument(DEFAULT_SITE_IDENTITY)

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
