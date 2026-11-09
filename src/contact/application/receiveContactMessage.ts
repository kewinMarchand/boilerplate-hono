import { contactMail, UnknownProductError } from '#/contact/domain/ContactMessage.ts'

import type { ContactMessage } from '#/contact/domain/ContactMessage.ts'

export interface ContactDependencies {
  readonly contactMessages: ContactMessage.Repository
  readonly contactProducts: ContactMessage.Products
  readonly contactRecipient: ContactMessage.Recipient
  readonly mailer: ContactMessage.Mailer
}

/**
 * Vérifie le produit d'une demande de renseignement (UnknownProductError), enregistre le message,
 * puis l'envoie par mail à l'adresse de l'identité du site (SPEC-COMMUNE, section 27), comme
 * SendContactMessage de l'API Platform. Un envoi en échec est confié à `onMailFailure` sans défaire
 * l'enregistrement : le visiteur n'a pas à réessayer un message déjà reçu. Le produit est cherché
 * par son slug dans la langue de la requête (`locale`) ; le message garde le slug de la langue par
 * défaut, celle du site (ADR 0014).
 */
export const receiveContactMessage = async (
  dependencies: ContactDependencies,
  draft: ContactMessage.Draft,
  locale: string,
  onMailFailure: (error: unknown) => void,
): Promise<ContactMessage.Entity> => {
  const product =
    draft.product === null ? null : await dependencies.contactProducts.find(draft.product, locale)
  if (draft.product !== null && product === null) {
    throw new UnknownProductError(draft.product)
  }
  const saved = await dependencies.contactMessages.save({
    ...draft,
    product: product?.slug ?? null,
  })
  try {
    const recipient = await dependencies.contactRecipient.address()
    await dependencies.mailer.send(contactMail(saved, product, recipient))
  } catch (error) {
    onMailFailure(error)
  }

  return saved
}
