import { describe, expect, it } from 'vitest'

import { markdownArticle } from '#/blog/infrastructure/markdownArticle.ts'

describe('markdownArticle', () => {
  it('convertit le Markdown en HTML, comme ArticleHtml de l’API Platform', () => {
    expect(markdownArticle.render('## Titre\n\nUn *texte*.')).toBe(
      '<h2>Titre</h2>\n<p>Un <em>texte</em>.</p>\n',
    )
  })

  it('échappe le HTML saisi et retire les liens dangereux', () => {
    const html = markdownArticle.render('<script>alert(1)</script>\n\n[lien](javascript:alert(1))')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('href="javascript:')
  })

  it('ne rend rien pour un texte vide', () => {
    expect(markdownArticle.render('')).toBe('')
  })
})
