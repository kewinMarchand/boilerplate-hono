import MarkdownIt from 'markdown-it'

import type { LegalPage } from '#/content/domain/LegalPage.ts'
import type Token from 'markdown-it/lib/token.mjs'

/**
 * Markdown d'une page légale en HTML découpé par titres de niveau 2, comme LegalPageSections de
 * l'API Platform : ce qui précède le premier titre forme l'introduction, chaque titre ouvre une
 * section. Le HTML saisi est échappé (`html: false`) et les liens javascript: et data: sont refusés
 * (vérification des liens de markdown-it) : les fronts injectent le résultat tel quel.
 */
const markdown = new MarkdownIt({ html: false })

/** Sans saut de ligne final, comme le rendu de league/commonmark côté API Platform. */
const render = (tokens: Token[]): string =>
  markdown.renderer.render(tokens, markdown.options, {}).replace(/\n$/, '')

export const markdownLegalPage: LegalPage.Renderer = {
  split: (body) => {
    const tokens = markdown.parse(body, {})
    const introduction: Token[] = []
    const sections: { title: string; tokens: Token[] }[] = []
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]
      if (token === undefined) {
        continue
      }
      if (token.type === 'heading_open' && token.tag === 'h2' && token.level === 0) {
        const title = (tokens[index + 1]?.children ?? [])
          .filter((child) => child.type === 'text' || child.type === 'code_inline')
          .map((child) => child.content)
          .join('')
        sections.push({ title, tokens: [] })
        index += 2
        continue
      }
      ;(sections.at(-1)?.tokens ?? introduction).push(token)
    }

    return {
      introduction: render(introduction),
      sections: sections.map((section) => ({ title: section.title, html: render(section.tokens) })),
    }
  },
}
