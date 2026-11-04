import { describe, expect, it } from 'vitest'

import { markdownLegalPage } from '#/content/infrastructure/markdownLegalPage.ts'
import { legalPageFixtures } from '#/content/infrastructure/mongoContent.ts'

describe('Pages légales : rendu du Markdown', () => {
  it.each(legalPageFixtures)('rend le HTML des fixtures de l’API Platform : $_id', (page) => {
    expect(markdownLegalPage.split(page.body)).toEqual({
      introduction: page.introduction,
      sections: page.sections,
    })
  })

  it('échappe le HTML saisi', () => {
    const { introduction } = markdownLegalPage.split('<script>alert(1)</script>')

    expect(introduction).not.toContain('<script>')
    expect(introduction).toContain('&lt;script&gt;')
  })

  it('refuse les liens javascript: et data:', () => {
    const { introduction } = markdownLegalPage.split(
      '[a](javascript:alert(1)) [b](data:text/html,x)',
    )

    expect(introduction).not.toContain('href')
  })

  it('ouvre une section à chaque titre de niveau 2, pas aux autres', () => {
    expect(markdownLegalPage.split('Intro\n\n## Un\n\nTexte\n\n### Sous-titre')).toEqual({
      introduction: '<p>Intro</p>',
      sections: [{ title: 'Un', html: '<p>Texte</p>\n<h3>Sous-titre</h3>' }],
    })
  })
})
