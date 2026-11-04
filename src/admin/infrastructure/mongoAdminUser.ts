import { z } from 'zod'

import type { AdminUser } from '#/admin/domain/AdminUser.ts'
import type { CollectionDefinition } from '#/shared/infrastructure/mongo.ts'
import type { Collection } from 'mongodb'

const adminUserDocumentSchema = z.object({
  _id: z.string().min(3),
  passwordHash: z.string().min(1),
})

type AdminUserDocument = z.infer<typeof adminUserDocumentSchema>

export const adminUserCollection: CollectionDefinition<typeof adminUserDocumentSchema> = {
  name: 'adminUsers',
  schema: adminUserDocumentSchema,
  indexes: [],
}

export class MongoAdminUserRepository implements AdminUser.Repository {
  private readonly collection: Collection<AdminUserDocument>

  constructor(collection: Collection<AdminUserDocument>) {
    this.collection = collection
  }

  async findByEmail(email: string): Promise<AdminUser.Entity | null> {
    const document = await this.collection.findOne({ _id: email })

    return document === null ? null : { email: document._id, passwordHash: document.passwordHash }
  }

  async save({ email, passwordHash }: AdminUser.Entity): Promise<void> {
    await this.collection.replaceOne({ _id: email }, { passwordHash }, { upsert: true })
  }
}
