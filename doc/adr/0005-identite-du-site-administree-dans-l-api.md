# 0005 — Identité du site administrée dans l'API : adoption de l'ADR 0006 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0006 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0006-identite-du-site-administree-dans-l-api.md) (« Identité du site administrée dans l'API, couleurs de marque calculées par l'API »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0001](0001-administration-ecrite-en-hono.md) (une section de plus dans l'admin) et l'[ADR 0002](0002-images-envoyees-par-l-admin.md) (un usage d'image sans recadrage). Contrat : section 22 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : l'API Platform sert `GET /api/site-identity`, dont les jetons de couleur sont calculés par l'API. Les deux API doivent donner les mêmes jetons pour les mêmes couleurs saisies, et refuser les mêmes saisies avec les mêmes messages.

## Décision

On applique l'ADR 0006 de l'API Platform telle quelle : même ressource, mêmes valeurs par défaut, mêmes règles de couleur (clair, sombre, contraste, arrondi au pair), mêmes messages, même usage d'image `logo` (200 et 400 px, sans recadrage, transparence gardée, SVG refusé), même fiche d'admin (logo retiré, texte de remplacement par défaut le nom du site, couleurs vérifiées avant l'encodage du logo).

Ce qui est propre à ce dépôt :

- **Module `site`** en fonctions pures et données immuables, comme les value objects du catalogue : `hexColor`, `brandPalette`, `brandColors` remplacent `HexColor`, `BrandPalette`, `ColorShades` et `BrandColors`.
- **Arrondi** : `roundHalfEven` arrondit la valeur exacte du flottant, comme `round()` de Python et `PHP_ROUND_HALF_EVEN`. Vérifié sur 200 paires de couleurs tirées au hasard contre le domaine PHP : palettes et messages identiques.
- **Stockage** : un document de la collection `siteIdentity` (`_id` 1), enregistré par `upsert` ; les fixtures l'insèrent avec les valeurs du modèle.
- **Logo** : la hauteur de la plus grande variante est un champ facultatif de `Media.Image` ; `sharpImageEncoder` relit les dimensions du fichier pour garder son ratio. Le SVG est lu par sharp mais refusé par la liste des types acceptés, comme en PHP.

## Conséquences

- **Positives** : les deux API restent interchangeables pour les fronts, identité du site comprise ; `make contract` le prouve, OpenAPI compris (`SiteIdentity`, `SiteTheme`, `ThemeTokens`).
- **Négatives / coûts** : ceux de l'ADR 0006 de l'API Platform. Les propriétés `light` et `dark` de `SiteTheme` n'ont pas de description dans l'OpenAPI (zod-openapi recopierait `ThemeTokens`). Une base de développement déjà remplie n'a pas le document des fixtures : l'API sert les valeurs du modèle jusqu'au premier enregistrement ou au prochain `make db-reset`.
- **Suivi** : suit l'ADR 0006 de l'API Platform. Si elle est remplacée, une nouvelle ADR remplace celle-ci.
