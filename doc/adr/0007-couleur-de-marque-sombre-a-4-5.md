# 0007 — Couleur de marque sombre à 4,5:1 : adoption de l'ADR 0008 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0008 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0008-couleur-de-marque-sombre-a-4-5.md) (« Couleur de marque du thème sombre éclaircie jusqu'à 4,5:1 »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Modifie** : l'[ADR 0005](0005-identite-du-site-administree-dans-l-api.md), sur le seul seuil de contraste du thème sombre. Contrat : section 22 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : les jetons sombres de `GET /api/site-identity` doivent être identiques dans les deux API pour les mêmes couleurs saisies.

## Décision

`DARK_CONTRAST` de `brandPalette` passe de 7 à 4,5 : en sombre, la couleur de marque est éclaircie par pas de 5 % de blanc jusqu'à 4,5:1 au moins sur `#0f141d`. Rien d'autre ne change (`-dark` à 25 % de blanc en plus, `on-*` de la couleur du fond, surfaces à 8, 12 et 19 %).

## Conséquences

- **Positives** : les deux API restent interchangeables, jetons sombres compris ; les tests reprennent les valeurs de `BrandPaletteTest` (`#1d4ed8` devient `#567ae2`, le noir `#808080`).
- **Négatives / coûts** : ceux de l'ADR 0008 de l'API Platform. Les jetons sombres d'une identité déjà enregistrée changent à la prochaine lecture, sans migration (ils sont recalculés).
- **Suivi** : suit l'ADR 0008 de l'API Platform.
