import { importDemoImages, mediaDependencies } from '#/database.ts'

import { TEST_MEDIA_DIR } from './integration/context.ts'

/**
 * Encode une seule fois les photos de démonstration, avant les fichiers de test : sans cela, chaque
 * fichier d'intégration les encode en parallèle à la première exécution (CI, dossier vide), et sa
 * préparation dépasse le délai.
 */
export default async function setup(): Promise<void> {
  await importDemoImages(mediaDependencies(TEST_MEDIA_DIR))
}
