# 0014 — Contenu multilingue activable, admin en français et en anglais : adoption de l'ADR 0015 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0015 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0015-contenu-multilingue-et-admin-bilingue.md) (« Contenu multilingue activable, admin en français et en anglais »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0001](0001-administration-ecrite-en-hono.md) (admin) et l'[ADR 0005](0005-identite-du-site-administree-dans-l-api.md) (identité du site). Contrat : section 29 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

L'API Platform rend le contenu traduisible (champs actuels pour la langue par défaut, une colonne JSON `translations` par entité), choisit la langue par requête (`locale`, puis `Accept-Language`), sert `Content-Language` et `alternates`, et traduit son admin. Cette API reproduit le même contrat, vérifié par `make contract`, et l'admin écrite en Hono doit offrir les mêmes onglets de langue et la même interface en deux langues. Reste à choisir la forme des documents MongoDB et la manière de traduire une admin sans framework de formulaires.

## Décision

On applique l'ADR 0015 de l'API Platform. Ce qui est propre à ce dépôt :

### Documents : champs actuels pour la langue par défaut, un sous-document `translations`

- Chaque document traduisible (produit, catégorie, attribut, article, rubrique ou format, page légale, page fixe, identité du site) garde ses champs, qui portent la langue par défaut, et gagne `translations` : `{ en: { name: "…", slug: "…" } }`, par langue puis par champ, valeurs non vides (`translationsSchema`, `shared/infrastructure/translations.ts`). Mêmes clés composées que l'API Platform : `galleryAlt.<empreinte>`, `choice.<valeur>`. L'identité gagne `locales`.
- C'est la transposition directe de la colonne JSON de l'API Platform, et c'est aussi la forme naturelle de MongoDB : un sous-document lu avec le document, sans jointure ni seconde collection. Les requêtes existantes (tri, filtres, index uniques sur `slug`) restent celles de la langue par défaut ; seules les lectures dans une autre langue regardent `translations`.
- **Slug par langue** : `slugFilter` cherche `{ $or: [{ "translations.<l>.slug": slug }, { slug, "translations.<l>.slug": { $exists: false } }] }`, l'équivalent du `COALESCE` de l'API Platform. La langue vient des langues activées (deux lettres), sûre dans un chemin de champ. Les catégories (dont le slug est l'identifiant) se cherchent dans l'arbre en mémoire, comme avant.
- **Tri par nom** : `$addFields: { sortName: { $ifNull: ["$translations.<l>.name", "$name"] } }` puis tri, collation de la langue demandée (celle du français par défaut, comme avant).
- **Texte traduit en HTML** : un article ou une page légale stocke le rendu HTML de la langue par défaut, produit à l'enregistrement ; un Markdown traduit est rendu à la lecture par le même port (`Article.Renderer`, `LegalPage.Renderer`), comme l'API Platform rend tout à la lecture. Rien de dérivé n'est stocké dans `translations`.
- **Domaine** : noyau partagé `shared/domain` (`translated`, `keptTranslations`, `switchDefaultLocale`, `takenSlug`, `RuleViolation`), seule dépendance commune des modules, autorisée dans `eslint.architecture.mjs`. Chaque module lit ses éléments dans une langue par des fonctions pures (`productIn`, `categoryIn`, `attributeIn`, `articleIn`, `termIn`, `pageMetaIn`, `siteIdentityIn`) : les entités restent des données immuables, sans trait ni getter.
- **Saisie absente** : un cas d'usage reçoit `translations` facultatif ; absent (site d'une seule langue, sans onglet), les traductions enregistrées sont gardées. L'API Platform les remplace par la saisie vide ; ici, des traductions dormantes ne se perdent pas en enregistrant une fiche.

### API

- `contentLocaleResolver` (`shared/http/contentLocale.ts`) : mêmes règles que `ContentLocale`, mémorisées par requête ; langues activées lues dans l'identité du site, passées par `app.ts`. Il voyage dans `RouteOptions`, comme `X-Scenario`.
- `contentLanguage`, middleware sur `/api/*` hors `/api/docs*` : `Content-Language` et `Vary: Accept-Language` sur toute réponse, erreurs et routes inconnues comprises. Langues illisibles (base injoignable) : la réponse, déjà une erreur, part sans `Content-Language`.
- `X-Scenario: bilingual` ajoute `en` dans le résolveur, désactivé en production comme les autres scénarios. Mêmes traductions dormantes dans les fixtures.
- OpenAPI : `openApiDocument` ajoute `locale`, `Accept-Language` et l'en-tête `Content-Language` à chaque lecture, comme `LocaleOpenApiFactory`.
- `make contract` compare `Content-Language` et `Vary` sur les cas bilingues ; de `Vary`, seul `Accept-Language` est du contrat (les autres valeurs viennent des bundles de l'API Platform).

### Reprise des bases existantes

- Au démarrage, `ensureSchema` complète les documents sans `translations` (vide) et l'identité sans `locales` (`["fr"]`), puis le validateur `$jsonSchema` plus strict s'applique. Idempotent ; le texte actuel reste celui de la langue par défaut, sans copie. Les bases des sites clients sont reprises sans commande.
- `make db-translations` (dev seulement) pose les traductions anglaises dormantes des fixtures sur une base de dev existante, sans `db-reset`, et seulement sur les documents encore sans traduction.

### Admin

- **Interface en deux langues** : `shared/http/adminI18n.ts`, dictionnaires `adminMessages/fr.ts` et `en.ts` (mêmes clés que `translations/admin.*.yaml` de l'API Platform quand elles existent ; le compilateur exige chaque clé dans les deux), `violations.en.ts` pour les règles du domaine, dont le modèle français sert de clé. La langue est portée par `AsyncLocalStorage` le temps de la requête : `t()` s'appelle depuis n'importe quelle page sans passer un traducteur à chaque fonction. Choix par `?_locale=`, mémorisé dans un cookie `admin_locale` (un an, `/admin`), français par défaut, page de connexion comprise. Sélecteur dans l'en-tête et sur la page de connexion.
- **Onglets de langue** : `languageTabs` (`shared/http/adminTranslations.ts`), boutons radio et CSS (`:has()`), sans script : la CSP de l'admin n'en autorise qu'un, celui de l'aperçu des images. Un onglet par langue du contenu, la langue par défaut en premier, seul à champs obligatoires ; onglet en erreur marqué et ouvert. Pas d'onglet à une seule langue. Champs traduits nommés `translations[<langue>][<champ>]` ; textes de la galerie et libellés des valeurs d'attribut traduits dans leur ligne.
- **Identité** : langue par défaut et autres langues (liste fixe de `CONTENT_LANGUAGES`, chaque langue écrite dans sa langue). Changer de langue par défaut appelle `switchContentLocale`, composé par `database.ts` depuis les cas d'usage `switch*DefaultLocale` de chaque module. Les catégories, dont le slug est l'identifiant, sont renommées partout (sous-catégories, produits et leurs chemins) ; produits, articles et termes sont remplacés en bloc, identifiants gardés, pour que deux slugs puissent s'échanger sans heurter les index uniques.

### Aucune dépendance ajoutée

`AsyncLocalStorage` est dans Node, les cookies et le middleware dans Hono.

## Conséquences

- **Positives** : contrat identique à l'API Platform, cas bilingue compris (`make contract` : 0 différence) ; un site monolingue garde ses réponses, `locales` et `alternates` en plus ; reprise automatique des bases ; interface de l'admin entière dans les deux langues, vérifiée par un test qui parcourt ses pages en anglais.
- **Négatives / coûts** : chaque requête de l'API lit l'identité du site (une lecture par identifiant). L'échange de langue par défaut n'est pas transactionnel : la base de dev est un MongoDB seul, sans replica set ; un échec en cours d'échange laisse des modules dans l'une et l'autre langue, et doit être relancé. L'unicité d'un slug traduit n'a pas d'index. Les onglets reposent sur `:has()` (navigateurs de 2023 et après).
- **Suivi** : suit l'ADR 0015 de l'API Platform.
