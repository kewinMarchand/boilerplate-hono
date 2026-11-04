# 0001 — Administration du catalogue et des contenus écrite en Hono, dans l'API

- **Statut** : Acceptée
- **Date** : 2026-11-04
- **Décideurs** : Kewin Marchand
- **Remplace** : le point « Hono : il reste une API de contrat, sans admin » de l'[ADR 0001 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0001-administration-easyadmin-dans-l-api.md) (« Administration du catalogue et des contenus par EasyAdmin, dans l'API »). Le reste de cette ADR ne change pas.

## Contexte

Cette API sert le même contrat public que boilerplate-api-platform, vérifié par `make contract`, en Node (Hono 4, zod) avec MongoDB par le pilote officiel, sans ODM. Ses données viennent des mêmes fixtures que Doctrine, chargées par `make db-reset` et jamais au démarrage.

L'ADR 0001 de l'API Platform a rendu le catalogue et les contenus administrables par EasyAdmin, dans l'application Symfony, et a laissé Hono sans admin : un projet client qui part de Hono n'est pas administrable, son client ne peut rien modifier sans développeur.

On veut que les deux API se valent pour un projet client : un front branché sur l'une ou l'autre, et une admin dans les deux.

Forces en présence :

- EasyAdmin n'existe qu'en Symfony. L'outil d'admin générée du monde Node, AdminJS, n'a pas d'adaptateur Hono ni d'accès à MongoDB sans Mongoose (relevé le 04/11/2026 : `@adminjs/hono` et `@adminjs/mongodb` n'existent pas, dernière version d'AdminJS en juillet 2025) ;
- les règles d'écriture sont fixées par l'ADR 0001 de l'API Platform : slug unique dans tout le catalogue, parent existant, profondeur de 3 niveaux au plus, prix positif ou nul, visuel entre 1 et 12, pas de suppression d'une catégorie qui a des produits ou des sous-catégories. Une admin qui écrirait directement dans les collections les contournerait ;
- le contrat public ne doit gagner aucune écriture, sinon il faudrait les ajouter aux deux API ;
- les collections ont déjà des validateurs `$jsonSchema` et le module `catalog` un domaine en lecture (`catalog.ts`, `categoryTree.ts`, `price.ts`) ;
- l'identifiant d'une catégorie est son slug (`_id`), ceux des produits et des articles des entiers sans compteur : seuls les messages de contact en ont un (`counters`).

## Décision

On écrit l'admin **en Hono, dans cette application**, sous `/admin`, sans nouvelle dépendance d'admin.

- **Pages rendues côté serveur** par Hono (JSX de `hono/jsx`), sans application front à construire : listes, fiches, formulaires de création et de modification, confirmation de suppression.
- **Périmètre** : celui de l'API Platform. Catégories et produits, articles, diapositives du carrousel, pages légales.
- **Connexion par session** : comptes d'administration dans une collection `adminUsers`, mot de passe haché par `node:crypto` (scrypt), cookie de session signé, `HttpOnly`, `SameSite=Strict`, protection CSRF des formulaires (`hono/csrf`), cinq essais par quart d'heure comme l'API Platform. Création d'un compte par une commande (`make admin EMAIL=…`), comme l'API Platform.
- **Écriture par des cas d'usage** (`createProduct`, `updateCategory`…) dans la couche application de chaque module, qui vérifient les règles ci-dessus puis enregistrent par le dépôt MongoDB. Les règles propres à un objet sont dans le domaine ; celles qui consultent les autres objets (unicité, suppression) sont vérifiées par le cas d'usage à l'aide des ports. Les formulaires ne touchent jamais les collections directement.
- **Identifiants** : un compteur par collection dans `counters` pour les produits, les articles et les diapositives, comme pour les messages de contact. Une catégorie garde son slug pour identifiant : changer le slug d'une catégorie la recrée et repointe ses produits et ses sous-catégories, dans le cas d'usage.
- **Le contrat public ne change pas** : les routes `/admin` sont hors du document OpenAPI, et `make contract` doit rester vert.
- **Fixtures** : inchangées, toujours la source des données de développement et de test ; `make db-reset` efface aussi ce qui a été saisi dans l'admin.

## Alternatives envisagées

- **AdminJS avec Express et Mongoose** : admin générée, vite branchée. Mais il ajoute deux briques (Express à côté de Hono, un ODM dans un projet qui n'en a pas), écrit directement dans les collections sans les règles du domaine, ce que l'ADR 0001 de l'API Platform a rejeté pour EasyAdmin, et le projet est peu actif. Rejetée.
- **Routes d'écriture dans le contrat public, avec une admin front (React-admin)** : rejetée par l'ADR 0001 de l'API Platform pour les mêmes raisons (écritures à coder dans les deux API, application front à déployer en plus).
- **Une admin commune aux deux API** (l'EasyAdmin de l'API Platform qui écrirait dans MongoDB) : couple les deux API, alors que chacune doit pouvoir partir seule chez un client. Rejetée.
- **Outil de gestion de base générique (mongo-express, Compass)** : c'est un outil de développeur, sans règles métier ni interface pour un client. Rejeté.
- **Rester sans admin** : la position de l'ADR 0001 de l'API Platform. Écartée : un projet parti de Hono doit pouvoir être modifié par son client.

## Conséquences

- **Positives** :
  - un projet client parti de Hono est administrable, comme un projet parti de l'API Platform ;
  - aucune dépendance ajoutée : Hono, zod et le pilote MongoDB suffisent ;
  - les règles d'écriture sont les mêmes dans les deux API, vérifiées chacune par ses tests ;
  - le contrat public et les fronts ne changent pas.
- **Négatives / coûts** :
  - beaucoup plus de code qu'une admin générée : pages, formulaires, messages d'erreur en français, authentification ; à écrire et à tester, sur plusieurs sessions ;
  - la sécurité de la connexion est écrite ici, pas fournie par un framework (Symfony Security) : hachage, session, CSRF, limitation des essais, à tester avec soin ;
  - les règles d'écriture existent en double (PHP et TypeScript) : toute règle ajoutée d'un côté doit l'être de l'autre ;
  - le module `catalog` gagne des écritures : le modèle « lecture seule » du domaine Hono est à réviser, comme celui de l'API Platform ;
  - stockage des images envoyées par l'admin : même question ouverte que pour l'API Platform, à trancher avant une mise en production.
- **Suivi** : rouvrir la décision si une bibliothèque d'admin pour Hono et MongoDB devient mûre, si l'écart de règles entre les deux API se met à dériver, ou si l'ADR 0001 de l'API Platform est elle-même remplacée (CMS, admin front). Une fois cette ADR acceptée : ajouter sur l'ADR 0001 de l'API Platform la mention « point Hono remplacé par boilerplate-hono ADR 0001 », et retirer « Pas d'administration » du `CLAUDE.md` de ce dépôt.
