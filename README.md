# boilerplate-hono

Seconde API de test des boilerplates front, en NoSQL. Elle sert exactement le même contrat que [boilerplate-api-platform](../boilerplate-api-platform) (API Platform, PostgreSQL, port 8090) : mêmes chemins, mêmes paramètres, mêmes formes JSON, mêmes codes et messages d'erreur, mêmes données. Un front passe de l'une à l'autre en changeant une seule variable d'URL.

| Ressource        | Opération                                               | Ce qu'elle renvoie                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Task`           | `GET /api/tasks`                                        | Les 3 tâches de démonstration (`id`, `title`, `done`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `Article`        | `GET /api/articles`                                     | 3 articles (`id`, `slug`, `title`, `excerpt`, `publishedAt`, `image`, `section`, `format`, `audio`, `speaker`), du plus récent au plus ancien ; filtres `section` et `format` (slug, inconnu : liste vide)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ArticleDetail`  | `GET /api/articles/{slug}`                              | Fiche d'un article : les mêmes champs, plus `html` (texte saisi en Markdown dans l'admin, converti à l'enregistrement), `metaTitle` et `metaDescription` ; 404 sinon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ArticleTerm`    | `GET /api/article-sections`, `GET /api/article-formats` | Rubriques et formats d'article (`slug`, `name`), par position, même sans article ([ADR 0009](doc/adr/0009-rubriques-formats-et-audio-des-articles.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `ContactMessage` | `POST /api/contact_messages`                            | 201 et le message enregistré, puis envoyé par mail à l'adresse de l'identité du site (même si l'envoi échoue), ou 422 avec les violations en français ; `product` facultatif (slug) pour une demande de renseignement, 422 « Ce produit n'existe pas. » s'il est inconnu ([ADR 0013](doc/adr/0013-vente-en-ligne-et-demande-de-renseignement.md))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Category`       | `GET /api/categories`                                   | L'arbre des 14 catégories du catalogue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `Product`        | `GET /api/products`                                     | Une page des 24 produits, filtrée et triée (filtre `attributes[<code>][]` compris) : un tableau JSON, vide au-delà de la dernière page ; chaque produit porte `attributes`, ses attributs configurables renseignés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ProductFacets`  | `GET /api/product-facets`                               | Le total des produits filtrés et les compteurs de facettes, attributs filtrables compris, mêmes filtres que la liste sans tri ni pagination                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ProductDetail`  | `GET /api/products/{slug}`                              | Fiche d'un produit : les champs de la liste, plus `categoryPath` (catégories de la racine à la sienne), `description` (texte brut, chaîne vide si aucune), `gallery` (8 images au plus, dans l'ordre, [ADR 0008](doc/adr/0008-galerie-et-sources-plus-petites-des-produits.md)), `metaTitle` et `metaDescription` ; 404 sinon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Product`        | `GET /api/featured-products`                            | Les produits « À la une » (case de l'admin), par nom, sous la forme des éléments de la liste : le carrousel de l'accueil                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `LegalPage`      | `GET /api/legal_pages/{slug}`                           | Une page légale découpée en sections HTML, ou 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `PageMeta`       | `GET /api/page-metas`                                   | Titre et description du référencement des pages fixes (`home`, `catalog`, `blog`, `contact`, `sitemap`, `legal-notice`, `privacy`, `accessibility`), toutes les clés, chaînes vides si non saisies (ADR 0010)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `SiteIdentity`   | `GET /api/site-identity`                                | L'identité du site saisie dans l'admin ([ADR 0005](doc/adr/0005-identite-du-site-administree-dans-l-api.md)) : `name`, `tagline`, `logo` (image ou `null`), `shareImage` (image 1200 × 630 ou `null`, [ADR 0010](doc/adr/0010-metadonnees-administrables.md)), `icon` (`null` ou `png32`, `png180`, `png192`, `png512`, [ADR 0011](doc/adr/0011-favicons-administrables.md)), `defaultColorScheme` (`auto`, `light`, `dark`), `salesEnabled` (vente en ligne : `false`, les fronts retirent prix et panier, [ADR 0013](doc/adr/0013-vente-en-ligne-et-demande-de-renseignement.md)) et `theme` (`null` sans couleurs saisies, sinon `light` et `dark` : les douze jetons de couleur de marque de boilerplates-ui, calculés par l'API ; en sombre, couleur éclaircie jusqu'à 4,5:1, [ADR 0007](doc/adr/0007-couleur-de-marque-sombre-a-4-5.md)) |

Les diapositives (`GET /api/slides`) sont retirées, comme dans l'API Platform : le carrousel des fronts montre les produits à la une ([ADR 0004 de l'API Platform](../boilerplate-api-platform/doc/adr/0004-carrousel-de-produits-a-la-une.md)).

Le détail du contrat (formats, paramètres du catalogue, règles du formulaire, `X-Scenario`, CORS) est celui du [README de l'API Platform](../boilerplate-api-platform/README.md#consommer-lapi-depuis-un-front) : il s'applique tel quel ici, à l'exception des écarts listés plus bas.

## Stack

| Brique                                                     | Rôle                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| Node 26.13, TypeScript 6 (strict)                          | Exécution directe des `.ts` (type stripping natif de Node)        |
| Hono 4.13, @hono/node-server 2.1                           | Serveur HTTP                                                      |
| zod 4.6, @hono/zod-openapi 1.6                             | Schémas, validation, OpenAPI 3.1 générés depuis les mêmes schémas |
| Driver officiel `mongodb` 7.8                              | Persistance, collections typées, sans ODM                         |
| MongoDB 8.2                                                | Base de données, non exposée sur la machine                       |
| Vitest 5, ESLint 10 (typescript-eslint strict), Prettier 3 | Tests, lint avec les types, format                                |

## Prérequis

- Docker avec Compose v2, `make` et git. Rien d'autre : Node, Yarn, les outils de qualité et les hooks Git tournent dans le conteneur.
- Les ports 8091 (API) et 8027 (interface de Mailpit) libres sur `127.0.0.1`.

## Démarrage

```sh
make install    # image, dépendances, hooks Git, conteneurs
make db-reset   # collections validées, index, fixtures
```

L'API répond sur http://localhost:8091/api, Swagger UI sur http://localhost:8091/api/docs dans un navigateur.

Les mails du formulaire de contact partent vers Mailpit (service `mailpit`, SMTP sur le réseau du compose seulement) : boîte de réception sur http://localhost:8027, ou `curl localhost:8027/api/v1/messages`. Le destinataire se règle dans l'admin (« Adresse qui reçoit les messages » de l'identité du site, `contact@example.com` dans les fixtures), l'expéditeur par `MAILER_FROM`. Les tests n'envoient aucun mail (faux mailer).

Le projet Compose s'appelle `boilerplate-hono` : ses conteneurs, son réseau et son volume (`boilerplate-hono_mongo_data`) ne touchent à aucun autre projet. Le conteneur de l'API tourne avec l'UID de l'utilisateur courant.

## Commandes

`make help` liste tout. Les principales :

| Commande                                                     | Effet                                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make install`                                               | Image, `yarn install` et hooks Husky dans le conteneur, conteneurs                                                                                        |
| `make lint-staged`                                           | Lint et format des fichiers indexés, dans le conteneur (appelé par le hook pre-commit, qui s'arrête avec un message clair si Docker est absent ou arrêté) |
| `make up` / `make down`                                      | Lance ou arrête les conteneurs (la base est conservée)                                                                                                    |
| `make db-reset`                                              | Recrée la base : validateurs `$jsonSchema`, index, mêmes fixtures que Doctrine                                                                            |
| `make db-translations`                                       | Base de dev existante : ajoute les traductions anglaises dormantes des fixtures, sans recréer la base                                                     |
| `make qa`                                                    | Lint (dont règles d'architecture), auto-test des règles, format, types, contrôle de `openapi.json`, tests                                                 |
| `make arch-selftest`                                         | Écrit six violations volontaires des règles d'architecture, exige l'échec d'ESLint, puis les retire                                                       |
| `make lint` / `make format` / `make typecheck` / `make test` | Chaque étape seule                                                                                                                                        |
| `make openapi`                                               | Exporte le schéma OpenAPI dans `openapi.json`                                                                                                             |
| `make contract`                                              | Compare cette API à l'API Platform, les deux lancées (voir plus bas)                                                                                      |
| `make logs` / `make sh` / `make mongo-sh`                    | Journaux, shell dans l'API, mongosh sur la base de dev                                                                                                    |
| `make docker-build-prod`                                     | Image de production (`boilerplate-hono:prod`)                                                                                                             |

## Basculer un front d'une API à l'autre

Les deux API ont les mêmes chemins sous `/api` : seule l'origine change.

```sh
# .env du front
API_URL=http://localhost:8090      # API Platform + PostgreSQL
API_URL=http://localhost:8091      # Hono + MongoDB

# types générés, identiques pour les schémas consommés par les fronts
API_SCHEMA_URL=http://localhost:8091/api/docs.jsonopenapi
```

Les origines CORS autorisées sont les mêmes (`CORS_ALLOW_ORIGIN`, surchargeable dans `.env`, voir `.env.example`).

## Client typé `hc`

Le type de l'application est exporté (`AppType`, `src/app.ts`). Un client TypeScript qui partage le dépôt, ou un test, l'utilise avec `hc` :

```ts
import { hc } from 'hono/client'

import type { AppType } from '../boilerplate-hono/src/app.ts'

const api = hc<AppType>('http://localhost:8091')

const response = await api.api['product-facets'].$get({ query: { category: 'feuillages' } })
if (response.status === 200) {
  const facets = await response.json() // ProductFacets, inféré depuis le schéma zod
  console.info(facets.totalItems, facets.exposure)
}
```

`tests/integration/typedClient.test.ts` exerce ce typage avec `testClient`.

## Typage de bout en bout

Le domaine et le langage publié sont séparés. Le domaine porte le modèle, le contrat (`src/<module>/http/contract.ts`) porte tout ce qui doit rester identique à l'API Platform :

1. **Domaine** (`src/<module>/domain/`) : types en namespaces (`Task.Entity`, `Catalog.ProductList`, `ContactMessage.Violation`), constantes et règles pures, sans zod, Hono ni MongoDB. Les règles renvoient des violations neutres (`{ field: 'email', kind: 'invalidFormat' }`).
2. **Contrat** (`src/<module>/http/contract.ts`) : schémas zod nommés par `.meta({ id })` (composants OpenAPI), messages exacts, codes de contrainte Symfony, `phpTrim`. Il traduit les violations du domaine en `violations[]` de l'API Platform. Le compilateur vérifie qu'une réponse du domaine est assignable au type du contrat.
3. **MongoDB** : chaque adaptateur déclare le schéma zod de son document (`_id`, dates en `Date`, `categoryPath` dénormalisé). `Collection<z.infer<…>>` type les requêtes, et `toBsonSchema` (`src/shared/infrastructure/bsonSchema.ts`) traduit le même schéma en validateur `$jsonSchema` appliqué à la création de la collection : MongoDB refuse un document qui ne le respecte pas.
4. **HTTP et OpenAPI** : les routes sont déclarées par `createRoute` avec les schémas du contrat. La validation d'entrée, le type des réponses et `openapi.json` en sortent.
5. **Client** : `AppType` porte les types des routes jusqu'à `hc`.

## Architecture

```
src/
  app.ts                  composition : routes, CORS, erreurs, documentation, AppType
  database.ts             composition : dépôts MongoDB, schéma, remise à zéro avec les fixtures
  server.ts               connexion MongoDB, schéma, serveur
  config.ts               variables d'environnement, validées par zod
  task/ blog/ contact/ catalog/ content/ media/ site/ admin/
    domain/               types, port du dépôt, règles pures (aucune dépendance)
    application/          cas d'utilisation (searchProducts, écritures de l'admin, identité du site)
    infrastructure/       schéma du document, adaptateur MongoDB, fixtures
    http/                 contract.ts (langage publié), routes createRoute, adaptation HTTP
  shared/
    http/                 négociation, problem+json, X-Scenario, CORS, query string PHP
    infrastructure/       connexion, création des collections, zod vers $jsonSchema
  scripts/                db-reset, export OpenAPI
tests/
  unit/                   règles pures
  integration/            HTTP via app.request contre un MongoDB réel
contract/                 comparaison automatique avec l'API Platform
tools/archSelftest.ts     auto-test des règles d'architecture
eslint.architecture.mjs   règles de dépendance entre modules et couches
```

Règles de dépendance, vérifiées par ESLint : le domaine n'importe que son propre domaine (ni zod, ni Hono, ni MongoDB), l'application que le domaine de son module, `http/` ni l'infrastructure ni un autre module, l'infrastructure ni `http/` ni un autre module, `shared/` aucun module. Tout import interne passe par `#/`, un chemin relatif qui remonte (`../`) est refusé.

Le catalogue calcule filtre, tri, pagination et compteurs disjonctifs en **une agrégation** : `$match` sur la branche (`categoryPath`), puis `$facet` avec la page, le total et un compteur par facette, chacun avec ses propres filtres, dont un compteur et un témoin de présence dans la branche par attribut filtrable. Les catégories (14 documents) et les attributs sont lus à part pour résoudre la branche, renvoyer 404, nommer les sous-catégories et retenir les filtres d'attributs connus.

## Test de compatibilité

```sh
make contract   # API Platform sur 8090 et cette API sur 8091, lancées et avec leurs fixtures
```

`contract/cases.ts` liste 431 requêtes représentatives (tous les scénarios des tests fonctionnels de l'API Platform, paramètres invalides, négociation, erreurs, CORS, cas bilingues avec `X-Scenario: bilingual`). Chacune part vers les deux API, puis le script compare statut, `Content-Type`, en-têtes utiles (`Allow`, `Location`, `Access-Control-*`, `Content-Language`, et `Vary` réduit à `Accept-Language`) et corps JSON normalisé : clés triées, clés de débogage Symfony (`trace`, `class`) retirées, origine des URL et dates-heures masquées, `id` d'un message de contact créé masqué. Les fichiers de `/media/` (fichier audio de démonstration, plages comprises) sont comparés octet par octet, avec `Content-Range` et `Content-Length`. Il compare ensuite les deux documents OpenAPI : opérations, paramètres, codes de réponse et schémas consommés par les fronts (seule la réponse 413 du contact, documentée ici, est écartée). Toute différence est listée et fait échouer la commande.

Les variables `CONTRACT_REFERENCE_URL` et `CONTRACT_CANDIDATE_URL` changent les deux origines. Les requêtes `POST` créent des messages de contact dans les deux bases.

### Écarts connus

Signalés par le script sans le faire échouer :

| Cas                                                 | API Platform                                                  | Ici                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Accept: application/ld+json`                       | JSON-LD (Hydra)                                               | JSON simple. JSON-LD n'est pas reproduit                                               |
| Corps JSON `null`, nombre ou booléen sur le contact | 500, détail citant la classe PHP de la ressource              | 500, même détail avec `ContactMessage`                                                 |
| Corps de plus de 64 Ko sur le contact               | 422 (message trop long), corps lu sans limite                 | 413 `application/problem+json`, « Le corps de la requête ne doit pas dépasser 64 Ko. » |
| 404 ou 405 du routeur sans `Accept` JSON            | Page HTML de débogage Symfony                                 | Même JSON qu'avec `Accept: application/json`                                           |
| Produit inconnu sur le contact                      | `type` tiré d'une empreinte d'objet PHP (violation sans code) | `/validation_errors/` ; propriété, message et `code: null` identiques                  |

Non comparés, mais à connaître :

- **Échappement** : l'API Platform échappe les accents (`é`) et les barres obliques (`\/`), ici le JSON est en UTF-8 brut. Les deux sont équivalents une fois décodés.
- **En-têtes** : `Link`, `ETag`, `X-Debug-*` ne sont pas reproduits ; de `Vary`, seul `Accept-Language` l'est (les autres valeurs viennent des bundles de l'API Platform).
- **OpenAPI** : 3.1.0 ici, 3.2.0 côté API Platform. Pas de variantes `.jsonld` ni de schémas Hydra. Le corps du `POST` contact est un schéma en ligne, la réponse 201 référence `ContactMessage` comme côté API Platform. Vérifié avec `openapi-typescript` 7.13 (la version des boilerplates) : les types générés pour les 11 schémas comparés et pour les paramètres de `/api/products` sont identiques.
- **Nombres JSON** : `1.0` est vu comme un entier (JavaScript ne distingue pas `1.0` de `1`), PHP y voit un flottant. Seul le libellé d'une erreur de type change.
- **Requêtes partielles sur `/media/`** : une seule plage (`bytes=début-fin`, `bytes=début-`, `bytes=-suffixe`) ; Caddy accepte aussi plusieurs plages (réponse `multipart/byteranges`), ici elles donnent le fichier entier. Les lecteurs audio ne demandent qu'une plage.
- **Routes absentes** : l'entrypoint `/api`, le suffixe de format (`/api/tasks.json`) et la redirection 301 des barres obliques finales.
- **Production** : une 500 y renvoie `Internal Server Error` comme détail. L'API Platform de comparaison tourne en dev, ce cas n'est pas comparé.

## Images

Comme dans l'API Platform ([ADR 0002](doc/adr/0002-images-envoyees-par-l-admin.md) de ce dépôt, qui adopte la sienne), produits et articles portent une image envoyée par l'admin. Le champ `image` vaut `{ alt, width, height, sources, src }`, ou `null` pour un objet d'avant l'envoi des images ; les adresses sont absolues, préfixées par `MEDIA_BASE_URL` (`http://localhost:8091` par défaut). Les variantes AVIF et WebP sont générées à l'envoi par `sharp` et écrites dans `MEDIA_DIR` (`var/media`), servi sous `/media/` avec un cache d'un an. Mêmes fixtures que l'API Platform (`fixtures/images`), donc mêmes noms de fichiers : seule l'origine des adresses diffère. Le logo de l'identité du site (usage `logo`, ADR 0005) n'est pas recadré : variantes de 200 et 400 px au ratio du fichier, `height` suivant ce ratio, transparence gardée ; le SVG est refusé. Image de partage (usage `share`) : 1200 × 630, une variante 1200. Favicons (usage `icon`, ADR 0011) : carrés, 512 px au moins, PNG seulement, de 32, 180, 192 et 512 px.

Une source n'est jamais agrandie ([ADR 0008](doc/adr/0008-galerie-et-sources-plus-petites-des-produits.md)) : un produit accepte une source de 400 px de large une fois recadrée, et une source de 600 px donne les variantes 400 et 600, `width` et `height` étant ceux de la plus grande (la largeur est gardée dans le document, `imageWidth` ou `width` d'une image de la galerie, `null` pour une source assez large). Fixtures : deux galeries, `monstera-deliciosa` (2 images) et `strelitzia-reginae` (3 images).

**Audio** ([ADR 0009](doc/adr/0009-rubriques-formats-et-audio-des-articles.md)) : un article peut porter un fichier MP3, M4A ou OGG (100 Mo au plus, format et durée lus dans les en-têtes à l'envoi, en TypeScript seul par `headerAudioInspector`), stocké tel quel sous `/media/<empreinte>.<extension>` (empreinte `sha256("audio\n" + contenu)` tronquée, comme en PHP) et servi avec les requêtes partielles : `audio` vaut `{ src, type, durationSeconds }` ou `null`. Fixture : `fixtures/audio/article-demo.mp3` (bip de 4 secondes généré par ffmpeg, sans droits, copié de l'API Platform), avec « Présenté par Hina Teriierooiterai », sur `un-carrousel-accessible-sans-dependance`.

## Blog et référencement

Mêmes fixtures que l'API Platform : deux rubriques (« Conseils », 2 articles ; « Actualités », 1 article) et un format (« Guide », 1 article). Rubriques et formats s'administrent dans les sections du même nom (`/admin/rubriques`, `/admin/formats`) ; supprimer un terme porté par un article est refusé (« La rubrique Conseils est utilisée par 2 articles. »). Le formulaire d'un article gagne la rubrique, le format, le fichier audio (case « Retirer le fichier audio », lecteur du fichier actuel), l'intervenant et le référencement.

Le référencement est facultatif partout (section 26 de `SPEC-COMMUNE.md`, [ADR 0010](doc/adr/0010-metadonnees-administrables.md)) : chaîne vide, le front garde sa valeur. Section « Référencement » de l'admin (`/admin/referencement`) : une fiche par page fixe, en modification seule (titre de 60 caractères, description de 160). Produits et articles ont les mêmes champs dans leur formulaire. Fixtures : seule la description de la page `blog` est saisie.

## Attributs de produit configurables

Comme dans l'API Platform ([ADR 0006](doc/adr/0006-attributs-de-produit-configurables.md) de ce dépôt, qui adopte son ADR 0007 ; section 23 de `SPEC-COMMUNE.md`) : les caractéristiques propres à un client se définissent dans l'admin, section « Attributs » (`/admin/attributs` : code fixé à la création, libellé, type `choice`, `number` ou `text`, unité, filtre du catalogue, position, valeurs d'une liste en lignes fixes, celles de l'attribut plus 3 vides), et le formulaire du produit gagne un champ par attribut. Chaque produit et chaque fiche exposent `attributes` (`code`, `label`, `type`, `value` en chaîne, `valueLabel`, `unit` ou `null`), par position. `GET /api/products` et `GET /api/product-facets` acceptent `attributes[<code>][]=<valeur>` pour les attributs filtrables (valeurs d'un attribut en OU, le reste en ET, code ou valeur inconnus ignorés) ; les facettes listent les attributs filtrables portés dans la branche, toutes leurs valeurs, avec des compteurs disjonctifs. Fixtures identiques : `feuillage` (liste filtrable, 8 produits) et `hauteur-adulte` (nombre, en cm, 6 produits). Refus en français, mêmes messages : code déjà pris, valeur en double, valeur retirée ou type changé alors que des produits les portent (« La valeur « Persistant » est utilisée par 6 produits. »), valeur d'un produit refusée par sa définition. Supprimer un attribut retire ses valeurs des produits.

## Identité du site

`GET /api/site-identity` sert l'identité saisie dans l'admin (`/admin/identite-du-site`, une seule fiche en modification seule), ou les valeurs du modèle tant que rien n'est enregistré (fixtures : nom et accroche du modèle, sans logo ni couleurs, `theme: null`, `auto`). Quand les deux couleurs de marque sont saisies, l'API calcule les douze jetons clair et sombre, avec les mêmes règles, les mêmes arrondis et les mêmes messages de validation que l'API Platform ([ADR 0005](doc/adr/0005-identite-du-site-administree-dans-l-api.md) ; en sombre, couleur éclaircie jusqu'à 4,5:1, [ADR 0007](doc/adr/0007-couleur-de-marque-sombre-a-4-5.md)). Dans l'admin, les couleurs sont des sélecteurs natifs (`<input type="color">`) derrière la case « Utiliser les couleurs de la bibliothèque » (cochée : `theme: null`, couleurs ignorées) ; le logo, l'icône et l'image de partage montrent leur aperçu et leur texte de remplacement au-dessus du champ d'envoi, chacun avec sa case « Retirer ». `X-Scenario: empty` sert l'identité par défaut, `error` une 500.

## Contenu multilingue et admin en deux langues

Comme dans l'API Platform ([ADR 0014](doc/adr/0014-contenu-multilingue-et-admin-bilingue.md) de ce dépôt, qui adopte son ADR 0015 ; section 29 de `SPEC-COMMUNE.md`) : un site n'a qu'une langue, le français, tant que l'admin n'en active pas d'autre (identité du site : langue par défaut et autres langues). `GET /api/site-identity` expose `locales`. La langue servie est celle du paramètre `locale` s'il désigne une langue activée, sinon la première langue activée d'`Accept-Language`, sinon la langue par défaut ; chaque réponse de l'API porte `Content-Language` et `Vary: Accept-Language`. Un champ non traduit prend la valeur de la langue par défaut ; un slug appartient à sa langue (slug d'une autre langue : 404). Fiches de produit et d'article, pages légales et nœuds de l'arbre des catégories exposent `alternates` (`[]` à une seule langue).

Les documents gardent leurs champs dans la langue par défaut et un sous-document `translations` (`{ en: { name, slug, … } }`). Les bases existantes sont complétées au démarrage (traductions vides, `locales: ["fr"]`), sans perte. Les fixtures portent quelques traductions anglaises, dormantes : `X-Scenario: bilingual` (dev et test) active l'anglais pour la requête, c'est le cas bilingue des tests et de `make contract`. Sur une base de dev d'avant ces traductions, `make db-translations` les ajoute sans `db-reset`.

L'admin est en français et en anglais (sélecteur dans l'en-tête et sur la page de connexion, choix mémorisé, français par défaut) ; ses libellés sont dans `src/shared/http/adminMessages/`. Les fiches traduisibles ont un onglet par langue activée, la langue par défaut en premier ; un site d'une seule langue n'en a pas.

## Suivi des erreurs (GlitchTip)

Désactivé par défaut. Renseigner `GLITCHTIP_DSN` (DSN au format Sentry) dans `.env` active le SDK `@sentry/node`. `GLITCHTIP_ENVIRONMENT` nomme l'environnement, `APP_ENV` sinon. Seules les erreurs inattendues partent : 5xx réelles, exceptions et rejets de promesse non gérés. Les 4xx (404, 405, 422 de validation…) et les erreurs simulées par `X-Scenario` ne sont jamais envoyées. Aucune donnée personnelle, aucun corps de requête, aucune trace de performance.

## Production

`make docker-build-prod` construit une image multi-étapes : dépendances sans `devDependencies`, sources `.ts` exécutées directement par Node, utilisateur `node`, port 8080, `APP_ENV=prod` (X-Scenario inactif). Elle attend `MONGODB_URI`, `MONGODB_DB` et `MEDIA_BASE_URL` (origine publique de l'API). Les images et les fichiers audio envoyés par l'admin sont écrits dans `MEDIA_DIR` (`var/media` par défaut, soit `/app/var/media`), à monter sur un volume persistant, propriétaire `node`, sauvegardé avec la base. Les collections et leurs validateurs sont créés au démarrage, les fixtures se chargent à part (`node src/scripts/dbReset.ts`).

## Intégration continue

`.github/workflows/ci.yml` n'appelle que des cibles `make`, donc les mêmes conteneurs que le poste de dev : `make install` (image, dépendances, MongoDB et API lancés), `make qa`, `make docker-build-prod`.

## Démarrer un projet à partir de ce dépôt

Le dépôt est marqué « template » sur GitHub.

### Créer le dépôt

Pour un nouveau projet, la voie recommandée est le bouton « Use this template » de GitHub, ou en ligne de commande :

```sh
gh repo create mon-projet --template kewinMarchand/boilerplate-hono --private --clone
```

Le nouveau dépôt part d'un historique vierge, sans lien avec l'original : un seul commit initial, aucun commit d'origine, et GitHub n'en garde que la mention « generated from ».

Pour suivre les évolutions de ce dépôt ou y contribuer, la voie est le fork, qui garde l'historique et le lien avec l'original :

```sh
gh repo fork kewinMarchand/boilerplate-hono --clone
```

### Récupérer les mises à jour plus tard

Dans le nouveau projet, ajouter ce dépôt comme source amont puis le lire :

```sh
git remote add upstream https://github.com/kewinMarchand/boilerplate-hono.git
git fetch upstream
```

- **Projet issu d'un fork** : les historiques sont liés, `git merge upstream/main` suffit.
- **Projet issu du template** : les historiques n'ont aucun commit commun et `git merge upstream/main` est refusé (« refusing to merge unrelated histories »). Reprendre les commits utiles un par un avec `git cherry-pick <commit>`, après les avoir repérés avec `git log upstream/main`. `git merge --allow-unrelated-histories` passe, mais chaque fichier présent des deux côtés avec un contenu différent devient un conflit, même un fichier que le projet n'a jamais touché.

### Ce qu'il faut personnaliser

| Sujet                              | Où                                                                                                                                                           | Quoi                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nom du paquet                      | `package.json`                                                                                                                                               | `name`, `description`                                                                                                                                                               |
| Nom du projet Docker et des images | `compose.yaml` (`name`, `image`), `Makefile` (`docker-build-prod`)                                                                                           | `boilerplate-hono` donne aussi le nom du réseau et du volume `boilerplate-hono_mongo_data`                                                                                          |
| Port publié                        | `compose.yaml`, `.env.example` (`API_PORT`), textes d'aide du `Makefile`, ce README                                                                          | 8091 sur `127.0.0.1`. Le conteneur écoute sur 8080 (`PORT`)                                                                                                                         |
| Variables d'environnement          | `src/config.ts` (valeurs par défaut, validées par zod), `.env.example`                                                                                       | `APP_ENV`, `PORT`, `MONGODB_URI`, `MONGODB_DB`, `CORS_ALLOW_ORIGIN` (origines des fronts autorisées), `MAILER_DSN` (`smtp://`, Mailpit dans le compose), `MAILER_FROM`              |
| Base MongoDB                       | `compose.yaml` (`mongo:8.2`, identifiants `app`/`app`), `MONGODB_DB` (`app`), `vitest.config.ts` (`app_test`), service `mongo` de `.github/workflows/ci.yml` | Garder `mongo:8.2` tant que le noyau de la machine est en 6.19 ou plus (voir `CLAUDE.md`)                                                                                           |
| Scénarios `X-Scenario`             | `src/shared/http/scenario.ts`, le middleware `scenario(…)` de chaque route                                                                                   | Actifs en dev et en test, sans effet quand `APP_ENV=prod`. À retirer d'une route qui n'en a pas besoin                                                                              |
| Contrat OpenAPI                    | `src/shared/http/openapiDocument.ts` (titre, description, version), `http/contract.ts` de chaque module                                                      | `make openapi` régénère `openapi.json`, `make qa` échoue s'il est périmé                                                                                                            |
| Parité avec l'API Platform         | `contract/`, `make contract`, `src/shared/http/phpQuery.ts`, `src/contact/http/deserializeContactMessage.ts`, les codes Symfony des `contract.ts`            | Ne sert que si le projet doit rester interchangeable avec une API Platform. Sinon, retirer `contract/`, la cible `contract` du `Makefile` et le script `contract` de `package.json` |
| Intégration continue               | `.github/workflows/ci.yml`                                                                                                                                   | Image du service MongoDB, nom de l'image construite                                                                                                                                 |
| Licence et documentation           | `LICENSE`, `README.md`, `CLAUDE.md`                                                                                                                          | Titulaire, description du projet                                                                                                                                                    |

### Retirer les modules d'exemple

Les cinq modules (`task`, `blog`, `contact`, `catalog`, `content`) sont des exemples. Pour en retirer un, noté `<module>` :

1. **Dossier** : supprimer `src/<module>/`.
2. **Routes et erreurs** (`src/app.ts`) : ses imports, son champ dans `AppDependencies`, son `.route('/', …Routes(…))`, son entrée dans `NOT_EXPOSED_ITEMS` (`/api/tasks/:id`, `/api/articles/:id`, `/api/contact_messages/:id`, `/api/categories/:slug`). Pour `catalog`, la ligne `CategoryNotFoundError` de `statusOf`. Pour `contact`, la branche `ContactMessageValidationError` de `onError`.
3. **Base et données de départ** (`src/database.ts`) : ses imports, ses collections dans `COLLECTIONS` (`counters` part avec `contact`), son dépôt dans `createRepositories` (pour `contact`, aussi `contactProducts` et `contactRecipient` ; puis le mailer de `src/server.ts`, le service `mailpit` de `compose.yaml` et `MAILER_*` de `src/config.ts`), ses `insertMany` dans `resetDatabase`. Puis `make db-reset` : la base est supprimée et recréée sans ses collections.
4. **Export OpenAPI** (`src/scripts/exportOpenapi.ts`) : son entrée dans `offline`. Puis `make openapi`.
5. **Règles d'architecture** : retirer le module de `MODULES` dans `eslint.architecture.mjs`. Dans `tools/archSelftest.ts`, chaque violation dont le fichier ou l'import vise le module retiré doit être déplacée vers un module gardé, sans en retirer aucune : les six règles doivent rester couvertes. Sont concernés `blog` (« module vers autre module »), `contact` (« domaine vers http par chemin relatif ») et `catalog` (quatre violations). Il faut garder au moins un module pour que l'auto-test ait où écrire.
6. **Tests** :
   - `contact` : `tests/unit/contactMessage.test.ts`, `nodemailerMailer.test.ts`, `tests/integration/contact.test.ts`, et `FakeMailer` de `tests/integration/context.ts`.
   - `catalog` : `tests/unit/catalog.test.ts`, `price.test.ts`, `productCriteria.test.ts`, `searchProducts.test.ts`, `tests/integration/products.test.ts`, et le bloc `GET /api/categories` de `tests/integration/resources.test.ts`.
   - `content` : les blocs `GET /api/legal_pages/{slug}` et `GET /api/page-metas` de `tests/integration/resources.test.ts`.
   - `site` : `tests/unit/hexColor.test.ts`, `brandPalette.test.ts`, `brandColors.test.ts`, `siteIdentity.test.ts`, `tests/integration/siteIdentity.test.ts` ; ses routes d'admin dans `sections` (`src/app.ts`), son entrée du menu (`src/shared/http/adminLayout.ts`) et du tableau de bord (`src/admin/http/pages.ts`).
   - `task` et `blog` n'ont pas de fichier propre, mais `resources.test.ts`, `scenarioAndCors.test.ts` et `typedClient.test.ts` passent par `/api/tasks` et `/api/articles` : leurs cas sont à supprimer ou à pointer vers une route gardée.
7. **Contrat** : si `make contract` est conservé, retirer les cas du module dans `contract/cases.ts` et ses schémas de `COMPARED_SCHEMAS` dans `contract/openapi.ts`.

Puis `make qa`. Vérifié en retirant `task` et `blog` : types et lint passent hors `typedClient.test.ts`, `make arch-selftest` reste vert après le déplacement d'une violation vers `contact`, et 13 tests à repointer échouent, tous dans les trois fichiers transverses cités.

## Licence

MIT
