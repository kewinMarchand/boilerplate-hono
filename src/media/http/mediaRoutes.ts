import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Hono } from 'hono'

const VARIANT_NAME = /^[0-9a-f]{32}-\d+\.(avif|webp)$/

/**
 * Variantes des images envoyées par l'admin (ADR 0002), lues dans MEDIA_DIR : nommées par l'empreinte
 * de leur contenu, elles ne changent jamais, d'où le cache d'un an. Mêmes en-têtes que le Caddy de
 * l'API Platform (docker/media.caddy).
 */
export const mediaRoutes = (directory: string) =>
  new Hono().get('/media/:name', async (c) => {
    const name = c.req.param('name')
    const match = VARIANT_NAME.exec(name)
    if (match === null) {
      return c.body(null, 404)
    }
    let content: Buffer
    try {
      content = await readFile(join(directory, name))
    } catch {
      return c.body(null, 404)
    }

    return c.body(new Uint8Array(content), 200, {
      'Content-Type': `image/${match[1]}`,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    })
  })
