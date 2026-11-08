import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Hono } from 'hono'

/** Variante d'une image, ou fichier audio stocké tel quel (ADR 0009). */
const MEDIA_NAME = /^[0-9a-f]{32}(?:-\d+\.(avif|webp|png)|\.(mp3|m4a|ogg))$/

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

/** Une seule plage `bytes=début-fin`, `bytes=début-` ou `bytes=-suffixe` ; null si absente ou multiple. */
const byteRange = (
  header: string | undefined,
  size: number,
): readonly [number, number] | 'invalide' | null => {
  const match = header === undefined ? null : /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) {
    return null
  }
  const [, first = '', last = ''] = match
  if (first === '' && last === '') {
    return 'invalide'
  }
  const [start, end] =
    first === ''
      ? [Math.max(0, size - Number(last)), size - 1]
      : [Number(first), last === '' ? size - 1 : Math.min(Number(last), size - 1)]
  return start > end || start >= size ? 'invalide' : [start, end]
}

/**
 * Fichiers de MEDIA_DIR : variantes des images envoyées par l'admin (ADR 0002) et fichiers audio des
 * articles (ADR 0009). Nommés par l'empreinte de leur contenu, ils ne changent jamais, d'où le cache
 * d'un an. Mêmes en-têtes que le Caddy de l'API Platform (docker/media.caddy), requêtes partielles
 * comprises (avance rapide du lecteur audio), sur une seule plage.
 */
export const mediaRoutes = (directory: string) =>
  new Hono().get('/media/:name', async (c) => {
    const name = c.req.param('name')
    const match = MEDIA_NAME.exec(name)
    if (match === null) {
      return c.body(null, 404)
    }
    const path = join(directory, name)
    let size: number
    try {
      size = (await stat(path)).size
    } catch {
      return c.body(null, 404)
    }
    const headers = {
      'Content-Type':
        match[1] === undefined ? (AUDIO_TYPES[match[2] ?? ''] ?? '') : `image/${match[1]}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    }
    const range = byteRange(c.req.header('Range'), size)
    if (range === 'invalide') {
      return c.body(null, 416, { ...headers, 'Content-Range': `bytes */${size}` })
    }
    const [start, end] = range ?? [0, size - 1]
    if (size === 0) {
      return c.body(null, 200, { ...headers, 'Content-Length': '0' })
    }
    return c.body(
      Readable.toWeb(createReadStream(path, { start, end })),
      range === null ? 200 : 206,
      {
        ...headers,
        'Content-Length': String(end - start + 1),
        ...(range === null ? {} : { 'Content-Range': `bytes ${start}-${end}/${size}` }),
      },
    )
  })
