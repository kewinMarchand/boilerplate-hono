# 0008 — Galerie des produits et sources plus petites : adoption de l'ADR 0009 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0009 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0009-galerie-et-sources-plus-petites-des-produits.md) (« Galerie des produits en JSON, sources de 400 px acceptées, jamais agrandies »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Modifie** : l'[ADR 0002](0002-images-envoyees-par-l-admin.md) et l'[ADR 0003](0003-variante-intermediaire-des-produits.md), sur la largeur minimale des images de produit et les largeurs générées. Contrat : section 24 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : `ProductDetail` gagne `gallery`, et le `srcset` d'une source étroite s'arrête à sa largeur. Les deux API doivent servir les mêmes galeries de démonstration et refuser les mêmes envois avec les mêmes messages.

## Décision

On applique l'ADR 0009 de l'API Platform telle quelle : `minimumWidth` (400 px pour un produit, la plus grande variante sinon), `widthsUpTo` (variantes arrêtées à la largeur de la source), largeur de la plus grande variante gardée par `Media.Image.width` quand elle est plus petite que celle de l'usage, galerie de 8 images au plus (« La galerie compte 8 images au plus (9 demandées). »), comptée avant tout encodage, triée par position, texte vide remplacé par le nom du produit, mêmes fixtures (`monstera-deliciosa` : `product-2`, `product-3` ; `strelitzia-reginae` : `product-11`, `product-12`, `product-1`).

Ce qui est propre à ce dépôt :

- **Stockage** : la galerie est un tableau du document produit (`gallery` : `key`, `alt`, `width` ou `null`), la largeur de l'image principale un champ `imageWidth` ; c'est l'équivalent naturel de la colonne JSON et de la colonne `image_width` de l'API Platform. Le validateur `$jsonSchema` borne le tableau à 8 éléments.
- **Admin** : une ligne par image enregistrée (aperçu et texte de remplacement, position, remplacement du fichier, case « Retirer cette image ») et deux lignes d'ajout, sans JavaScript (`adminGalleryFields`). L'empreinte de l'image d'une ligne voyage dans un champ caché ; le cas d'usage ne retient que les empreintes de la galerie actuelle du produit, une autre vaut une ligne d'ajout.

## Conséquences

- **Positives** : les deux API restent interchangeables, galerie et `srcset` compris ; `make contract` le prouve (fiches de `monstera-deliciosa`, `strelitzia-reginae` et `palmier-nain`, schéma `ProductDetail`).
- **Négatives / coûts** : ceux de l'ADR 0009 de l'API Platform. Une base de développement d'avant cette décision n'a ni `gallery` ni `imageWidth` sur ses produits, et le validateur les exige : `make db-reset` la recrée.
- **Suivi** : suit l'ADR 0009 de l'API Platform.
