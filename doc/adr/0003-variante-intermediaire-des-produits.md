# 0003 — Variante intermédiaire des produits : adoption de l'ADR 0003 de l'API Platform

- **Statut** : Acceptée
- **Date** : 2026-11-07
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0003 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0003-variante-intermediaire-des-produits.md) (« Variante intermédiaire de 640 px pour les images des produits »), qui complète l'ADR 0002 adoptée par l'[ADR 0002](0002-images-envoyees-par-l-admin.md) de ce dépôt. La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : le `srcset` des produits doit lister les mêmes largeurs dans les deux API.

## Décision

Les images des produits ont trois variantes, 400, 640 et 800 px (`WIDTHS.product` de `imageRules`). Rien d'autre ne change.

## Conséquences

- **Positives** : les deux API restent interchangeables pour les fronts.
- **Négatives / coûts** : ceux de l'ADR 0003 de l'API Platform. `make db-reset` réencode les photos de démonstration des produits.
- **Suivi** : suit l'ADR 0003 de l'API Platform.
