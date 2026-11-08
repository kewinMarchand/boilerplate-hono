# 0010 — Métadonnées administrables : adoption de l'ADR 0011 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0011 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0011-metadonnees-administrables.md) (« Métadonnées administrables : pages fixes, produits, articles, image de partage »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0005](0005-identite-du-site-administree-dans-l-api.md) (un champ de plus dans l'identité du site) et l'[ADR 0001](0001-administration-ecrite-en-hono.md) (section « Référencement »). Contrat : section 26 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : `GET /api/page-metas`, `metaTitle` et `metaDescription` sur `ProductDetail` et `ArticleDetail`, `shareImage` sur `SiteIdentity`.

## Décision

On applique l'ADR 0011 de l'API Platform telle quelle : huit pages fixes dans l'ordre de `MetaPage` (`META_PAGES`, mêmes clés et mêmes libellés), titre de 60 caractères et description de 160 au plus, contrôlés à la frontière (`readMetaFields`, commun aux trois formulaires), valeurs enregistrées sans blancs de début ni de fin, toutes les clés servies (chaînes vides pour une page sans document), image de partage en usage `share` (1200 × 630, une variante 1200, texte vide remplacé par le nom du site, case « Retirer l'image de partage »), mêmes fixtures (seule la description de `blog` est saisie).

Ce qui est propre à ce dépôt :

- **Clé de la page comme identifiant** : collection `pageMetas`, `_id` = clé de la page, comme le slug des pages légales. L'objection de l'API Platform (EasyAdmin et une énumération en clé primaire) ne vaut pas pour l'admin écrite en Hono, dont l'adresse est `/admin/referencement/<page>/modifier`.
- **Lignes créées par les fixtures** seulement, `make db-reset` les insère : il n'y a pas de migration ici.

## Conséquences

- **Positives** : le référencement se règle sans livraison, dans les deux API ; `make contract` le prouve (`PageMeta`, fiches, identité du site).
- **Négatives / coûts** : ceux de l'ADR 0011 de l'API Platform. Une page fixe ajoutée aux fronts demande une entrée de `META_PAGES` et sa ligne dans les fixtures.
- **Suivi** : suit l'ADR 0011 de l'API Platform.
