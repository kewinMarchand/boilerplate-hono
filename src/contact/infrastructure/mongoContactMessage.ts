import { z } from 'zod'

import { nextSequence } from '#/shared/infrastructure/counters.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'
import type { CounterDocument } from '#/shared/infrastructure/counters.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const contactMessageDocumentSchema = z.object({
  _id: z.int().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  message: z.string().min(1),
  /** Slug du produit d'une demande de renseignement, null pour un message de contact simple. */
  product: z.string().nullable(),
  receivedAt: z.date(),
})

type ContactMessageDocument = z.infer<typeof contactMessageDocumentSchema>

export const contactMessageCollection: CollectionDefinition<typeof contactMessageDocumentSchema> = {
  name: 'contact_messages',
  schema: contactMessageDocumentSchema,
  indexes: [{ key: { receivedAt: -1 } }],
}

const toContactMessage = ({ _id, ...draft }: ContactMessageDocument): ContactMessage.Entity => ({
  id: _id,
  ...draft,
})

/** Identifiant entier auto-incrémenté (comme la séquence PostgreSQL), via un compteur atomique. */
export class MongoContactMessageRepository implements ContactMessage.Repository {
  private readonly messages: Collection<ContactMessageDocument>
  private readonly counters: Collection<CounterDocument>

  constructor(messages: Collection<ContactMessageDocument>, counters: Collection<CounterDocument>) {
    this.messages = messages
    this.counters = counters
  }

  async save(draft: ContactMessage.Draft): Promise<ContactMessage.Entity> {
    const id = await nextSequence(this.counters, contactMessageCollection.name)
    await this.messages.insertOne({ _id: id, ...draft })

    return { id, ...draft }
  }

  async findLatestFirst(): Promise<ContactMessage.Entity[]> {
    return (await this.messages.find().sort({ receivedAt: -1, _id: -1 }).toArray()).map(
      toContactMessage,
    )
  }

  async find(id: number): Promise<ContactMessage.Entity | null> {
    const document = await this.messages.findOne({ _id: id })
    return document === null ? null : toContactMessage(document)
  }
}
