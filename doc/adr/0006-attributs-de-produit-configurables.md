# 0006 — Attributs de produit configurables : adoption de l'ADR 0007 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0007 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0007-attributs-de-produit-configurables.md) (« Attributs de produit configurables, définis dans l'admin, stockés en JSON »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0001](0001-administration-ecrite-en-hono.md) (une section de plus dans l'admin). Contrat : section 23 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : elle expose `attributes` sur les produits, les fiches et les facettes, et accepte le filtre `attributes[<code>][]`. Les deux API doivent servir les mêmes fixtures, filtrer et compter de la même façon, et refuser les mêmes saisies de l'admin avec les mêmes messages.

## Décision

On applique l'ADR 0007 de l'API Platform telle quelle : mêmes types (`choice`, `number`, `text`), mêmes règles (valeurs et filtre réservés à une liste, valeurs sans doublon, code unique et fixé à la création, valeur retirée ou type changé refusés tant que des produits les portent, suppression qui nettoie les produits), mêmes contrôles d'une valeur de produit, mêmes messages, même contrat, mêmes fixtures (`feuillage` et `hauteur-adulte`, portés par les mêmes produits), même formulaire (lignes de valeurs fixes, celles de l'attribut plus 3 vides, sans JavaScript).

Ce qui est propre à ce dépôt :

- **Stockage** : collection `productAttributes`, le code sert d'identifiant (`_id`), comme le slug des catégories ; les valeurs d'une liste sont un tableau du document. Les valeurs d'un produit sont un objet `attributeValues` du document produit (`code → valeur en chaîne`), retirées par `$unset` à la suppression d'un attribut. Le document MongoDB est l'équivalent naturel des colonnes JSON de l'API Platform.
- **Recherche dans MongoDB**, comme les autres facettes : le domaine (`toSearchQuery`) retient les filtres des attributs filtrables et leurs valeurs connues, le dépôt les ajoute aux filtres de l'agrégation et, par attribut filtrable, ajoute au `$facet` un compteur disjonctif (tous les filtres sauf celui de l'attribut) et un témoin de présence dans la branche, sans filtre. `toProductList` complète chaque attribut compté avec toutes ses valeurs, à 0 compris.
- **Règles** en fonctions pures (`productAttribute.ts` : `productAttribute`, `attributeValueFor`, `checkAttributeValues`, `attributeValuesOf`), comme les value objects du catalogue. Les comptes « portés par N produits » parcourent tous les produits dans le cas d'usage, comme en PHP.
- **Admin** : section `/admin/attributs` ; le champ code est désactivé à la modification, le code de l'adresse fait foi. Un nombre invalide dans le formulaire du produit est refusé par le cas d'usage (« L'attribut « Hauteur adulte » attend un nombre. »), là où Symfony refuse d'abord la saisie par son champ nombre : même statut 422, autre message.

## Conséquences

- **Positives** : les deux API restent interchangeables pour les fronts, attributs compris ; `make contract` le prouve, OpenAPI compris (`AttributeValue`, `AttributeFacet`, `AttributeFacetValue`, paramètre `attributes` en `deepObject`).
- **Négatives / coûts** : ceux de l'ADR 0007 de l'API Platform. Deux attributs de même position sont départagés par leur code, et non par leur ordre de création comme en PHP (identifiant entier) : sans effet sur les fixtures, dont les positions diffèrent. Une base de développement d'avant cette décision n'a ni attributs ni `attributeValues` sur ses produits : `make db-reset` la recrée.
- **Suivi** : suit l'ADR 0007 de l'API Platform. Si elle est remplacée, une nouvelle ADR remplace celle-ci.
