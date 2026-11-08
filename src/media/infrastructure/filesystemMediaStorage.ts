import { randomBytes } from 'node:crypto'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { Media } from '#/media/domain/Media.ts'

/** Variante d'une image, ou fichier audio stocké tel quel (ADR 0009). */
const MEDIA_NAME = /^[0-9a-f]{32}(-\d+\.(avif|webp|png)|\.(mp3|m4a|ogg))$/

const pathIn = (directory: string, name: string): string => {
  if (!MEDIA_NAME.test(name)) {
    throw new Error(`Nom de fichier inattendu : ${name}.`)
  }
  return join(directory, name)
}

/** Variantes des images et fichiers audio dans un dossier du volume de l'API (MEDIA_DIR), servi sous /media/ par mediaRoutes. */
export const filesystemMediaStorage = (directory: string): Media.Storage => ({
  async has(name) {
    try {
      await access(pathIn(directory, name))
      return true
    } catch {
      return false
    }
  },

  async put(name, content) {
    const path = pathIn(directory, name)
    await mkdir(directory, { recursive: true })
    // Écrit à côté puis renomme : le serveur ne sert jamais un fichier à moitié écrit
    const temporary = `${path}.${randomBytes(4).toString('hex')}.tmp`
    try {
      await writeFile(temporary, content)
      await rename(temporary, path)
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  },
})
