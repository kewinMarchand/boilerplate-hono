import { describe, expect, it } from 'vitest'

import { CategoryNotFoundError } from '#/catalog/domain/CategoryNotFoundError.ts'
import { CategoryTree } from '#/catalog/domain/categoryTree.ts'
import { parseCriteria } from '#/catalog/domain/productCriteria.ts'
import { emptyProductList, toProductList, toSearchQuery } from '#/catalog/domain/productSearch.ts'
import { categoryFixtures } from '#/catalog/infrastructure/catalogFixtures.ts'
import { rawCriteriaFromQuery } from '#/catalog/http/productQuery.ts'

const tree = CategoryTree.of(categoryFixtures)

describe('arbre des catégories', () => {
  it('construit 3 racines et 14 catégories', () => {
    const nodes = CategoryTree.toNodes(tree)
    expect(nodes.map((node) => node.slug)).toEqual([
      'plantes-interieur',
      'plantes-exterieur',
      'plantes-aquatiques',
    ])
    expect(nodes[0]?.children[0]?.children.map((node) => node.slug)).toEqual([
      'monstera',
      'fougeres',
    ])
  })

  it('liste les enfants directs triés par position', () => {
    expect(
      CategoryTree.childrenOf(tree, CategoryTree.find(tree, 'feuillages')).map(
        (category) => category.slug,
      ),
    ).toEqual(['monstera', 'fougeres'])
    expect(CategoryTree.childrenOf(tree, CategoryTree.find(tree, 'monstera'))).toEqual([])
  })

  it('calcule le chemin depuis la racine', () => {
    expect(CategoryTree.pathTo(tree, 'monstera')).toEqual([
      'plantes-interieur',
      'feuillages',
      'monstera',
    ])
  })

  it('liste les racines pour le parent null', () => {
    expect(CategoryTree.childrenOf(tree, null)).toHaveLength(3)
  })

  it('lève CategoryNotFoundError avec le message français', () => {
    expect(() => CategoryTree.find(tree, 'cactus')).toThrow(new CategoryNotFoundError('cactus'))
    expect(() => CategoryTree.find(tree, 'cactus')).toThrow('Catégorie introuvable : cactus')
  })
})

describe('liste de produits', () => {
  it('complète les facettes à 0 dans un ordre fixe', () => {
    const children = CategoryTree.childrenOf(tree, CategoryTree.find(tree, 'feuillages'))
    const list = toProductList(children, {
      items: [],
      totalItems: 6,
      exposureCounts: { ombre: 2, 'mi-ombre': 4 },
      sizeCounts: { L: 1 },
      categoryCounts: { fougeres: 3 },
    })

    expect(list.facets.exposure).toEqual([
      { value: 'soleil', count: 0 },
      { value: 'mi-ombre', count: 4 },
      { value: 'ombre', count: 2 },
    ])
    expect(list.facets.size.map((facet) => facet.count)).toEqual([0, 0, 1])
    expect(list.facets.category).toEqual([
      { slug: 'monstera', name: 'Monstera', count: 0 },
      { slug: 'fougeres', name: 'Fougères', count: 3 },
    ])
  })

  it('traduit la pagination en décalage', () => {
    const criteria = parseCriteria(rawCriteriaFromQuery('page=3&itemsPerPage=5'))
    expect(toSearchQuery(criteria, [])).toMatchObject({ skip: 10, limit: 5, branch: null })
  })

  it('a une forme vide pour X-Scenario: empty', () => {
    expect(emptyProductList()).toMatchObject({ items: [], totalItems: 0 })
  })
})
