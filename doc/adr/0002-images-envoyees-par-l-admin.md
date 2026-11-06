# 0002 — Images envoyées par l'admin : adoption de l'ADR 0002 de l'API Platform

- **Statut** : Acceptée
- **Date** : 2026-11-07
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0002 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0002-images-envoyees-par-l-admin.md) (« Images envoyées par l'admin : volume de l'API, variantes générées à l'envoi »), qui tranche la question laissée ouverte par l'[ADR 0001](0001-administration-ecrite-en-hono.md) de ce dépôt (« stockage des images envoyées par l'admin »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie. L'ADR 0002 de l'API Platform change le champ `image` des diapositives, des produits et des articles, d'un numéro de visuel en un objet, et place les fichiers dans un volume de l'API. Cette API doit suivre, à l'octet près pour les réponses JSON.

## Décision

On applique l'ADR 0002 de l'API Platform telle quelle : même port de stockage, mêmes largeurs et ratios, mêmes contrôles et mêmes messages à l'envoi, même nommage des variantes, même objet `image` dans le contrat, mêmes fixtures importées par le même chemin que l'admin.

Ce qui est propre à ce dépôt :

- **Encodage** : `sharp` (libvips), qui écrit l'AVIF et le WebP sur `node:26-alpine` sans dépendance système, aux mêmes qualités que l'encodeur GD de l'API Platform (AVIF 50, WebP 75).
- **Empreinte** : `sha256(usage + "\n" + contenu)`, tronquée à 32 caractères, exactement comme en PHP. Les mêmes photos de démonstration (`fixtures/images`, copie de celles de l'API Platform) donnent donc les mêmes noms de fichiers, et les réponses des deux API ne diffèrent que par l'origine des adresses (`MEDIA_BASE_URL`), que `make contract` masque déjà.
- **Service des fichiers** : la route `GET /media/{fichier}` de l'application (`mediaRoutes`), avec les en-têtes du Caddy de l'API Platform (`Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff`).

## Conséquences

- **Positives** : les deux API restent interchangeables pour les fronts, images comprises ; `make contract` le prouve, OpenAPI compris (`ImageView`, `ImageSource`).
- **Négatives / coûts** : `sharp` ajoute environ 17 Mo de binaires natifs (`@img/sharp-linuxmusl-x64` et sa libvips) ; les variantes ne sont pas identiques à l'octet à celles de GD (même nom, contenu encodé par un autre outil) ; le volume `MEDIA_DIR` se sauvegarde avec la base MongoDB.
- **Suivi** : suit l'ADR 0002 de l'API Platform. Si elle est remplacée, une nouvelle ADR remplace celle-ci.
