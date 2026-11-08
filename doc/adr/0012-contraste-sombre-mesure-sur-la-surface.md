# 0012 — Contraste sombre mesuré sur la surface : adoption de l'ADR 0013 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0013 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0013-contraste-sombre-mesure-sur-la-surface.md) (« Contraste de la couleur de marque sombre mesuré sur la surface secondaire »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Modifie** : l'[ADR 0007](0007-couleur-de-marque-sombre-a-4-5.md), sur la seule couleur contre laquelle le seuil est mesuré. Contrat : section 22 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : les jetons sombres de `GET /api/site-identity` doivent être identiques dans les deux API pour les mêmes couleurs saisies.

## Décision

`readableOnDark` de `brandPalette` mesure le seuil de 4,5:1 sur `#1c222e` (`DARK_CONTRAST_SURFACE`), la surface secondaire sombre de boilerplates-ui, au lieu du fond `#0f141d`. Les surfaces restent mélangées avec le fond et `on-*` reste `#0f141d`.

## Conséquences

- **Positives** : les deux API restent interchangeables, jetons sombres compris ; les tests reprennent les valeurs de `BrandPaletteTest` (`#e10600` devient `#ec5d59`, `#1d4ed8` devient `#6c8ce6`, le noir `#8c8c8c`).
- **Négatives / coûts** : ceux de l'ADR 0013 de l'API Platform.
- **Suivi** : suit l'ADR 0013 de l'API Platform.
