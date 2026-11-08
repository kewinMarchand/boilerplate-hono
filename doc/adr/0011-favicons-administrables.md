# 0011 — Favicons administrables : adoption de l'ADR 0012 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0012 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0012-favicons-administrables.md) (« Favicons générés en PNG depuis l'icône du site »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0005](0005-identite-du-site-administree-dans-l-api.md) (un champ de plus dans l'identité du site) et l'[ADR 0002](0002-images-envoyees-par-l-admin.md) (un usage d'image encodé en PNG). Contrat : puce « Icône du site » de la section 22 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : `icon` vaut `null` ou `{ png32, png180, png192, png512 }` (schéma `SiteIcon`).

## Décision

On applique l'ADR 0012 de l'API Platform telle quelle : usage `icon`, carré, 512 px au moins, recadré au centre, jamais agrandi, variantes de 32, 180, 192 et 512 px en PNG seulement (`formatsOf`, `fallbackFormatOf`), image décorative, case « Retirer l'icône », aperçu de la variante 192 dans l'admin. `sharp` écrit le PNG en compression 9, transparence gardée, comme GD.

## Conséquences

- **Positives** : les deux API restent interchangeables ; l'icône se change depuis l'admin, sans déploiement des fronts.
- **Négatives / coûts** : ceux de l'ADR 0012 de l'API Platform.
- **Suivi** : suit l'ADR 0012 de l'API Platform.
