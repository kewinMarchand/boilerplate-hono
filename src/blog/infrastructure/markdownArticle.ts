import MarkdownIt from 'markdown-it'

import type { Article } from '#/blog/domain/Article.ts'

/**
 * Markdown de la fiche d'un article en HTML, comme ArticleHtml de l'API Platform : HTML saisi échappé
 * (`html: false`), liens javascript: et data: refusés (vérification des liens de markdown-it). Les
 * fronts injectent le résultat tel quel.
 */
const markdown = new MarkdownIt({ html: false })

export const markdownArticle: Article.Renderer = {
  render: (body) => markdown.render(body),
}
