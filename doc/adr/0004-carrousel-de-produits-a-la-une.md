# 0004 — Carrousel de produits à la une : adoption de l'ADR 0004 de l'API Platform

- **Statut** : Proposée
- **Date** : 2026-11-07
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0004 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0004-carrousel-de-produits-a-la-une.md) (« Carrousel de l'accueil : produits à la une, diapositives retirées »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Modifie** : l'[ADR 0001](0001-administration-ecrite-en-hono.md) (plus de section « Carrousel » dans l'admin) et l'[ADR 0002](0002-images-envoyees-par-l-admin.md) (plus d'usage d'image `slide`).

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : l'API Platform ne sert plus `GET /api/slides`, et sert `GET /api/featured-products`.

## Décision

Les produits portent `featured` (case « À la une » de l'admin) et `GET /api/featured-products` les liste par nom. Les diapositives sont retirées : domaine, dépôt et collection, admin, route, contrat, fixtures et photos `slide-*`, usage d'image `slide`.

## Conséquences

- **Positives** : les deux API restent interchangeables pour les fronts.
- **Négatives / coûts** : ceux de l'ADR 0004 de l'API Platform. Une base de développement déjà remplie garde sa collection `slides`, que plus rien ne lit, jusqu'au prochain `make db-reset`.
- **Suivi** : suit l'ADR 0004 de l'API Platform.
