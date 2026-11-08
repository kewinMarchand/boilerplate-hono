# 0009 — Rubriques, formats et audio des articles : adoption de l'ADR 0010 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0010 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0010-rubriques-formats-et-audio-des-articles.md) (« Rubriques et formats d'articles dans une table, audio lu en PHP sans dépendance »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0001](0001-administration-ecrite-en-hono.md) (deux sections de plus dans l'admin) et l'[ADR 0002](0002-images-envoyees-par-l-admin.md) (un fichier audio stocké et servi comme les images). Contrat : section 25 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : `section`, `format`, `audio` et `speaker` sur les articles, filtres `section` et `format`, `GET /api/article-sections` et `GET /api/article-formats`. Le fichier audio de démonstration doit avoir la même empreinte, donc la même adresse, et la même durée dans les deux API.

## Décision

On applique l'ADR 0010 de l'API Platform telle quelle : une seule liste de termes par sorte (`section`, `format`), slug unique dans sa sorte, mêmes messages accordés (« La rubrique Conseils est utilisée par 2 articles. », « Le slug « guide » est déjà pris par un autre format. »), suppression refusée tant qu'un article porte le terme (compte fait sur la liste des articles), filtres appliqués après lecture (slug inconnu : liste vide ; valeur en tableau ignorée, sémantique PHP de la query string), fichier audio de 100 Mo au plus, format reconnu au contenu, durée arrondie (1 s au moins), empreinte `sha256("audio\n" + contenu)` tronquée, intervenant de 80 caractères au plus, mêmes fixtures (« Conseils », « Actualités », « Guide », `fixtures/audio/article-demo.mp3` copié de l'API Platform).

Ce qui est propre à ce dépôt :

- **Lecture des en-têtes en TypeScript seul** (`media/infrastructure/headerAudioInspector.ts`), port de `HeaderAudioInspector` : MP3 (ID3v2 sauté, deux trames consécutives, Xing, Info ou VBRI, sinon débit constant), OGG Vorbis et Opus, M4A audio seul. Aucune dépendance : `music-metadata` lirait bien plus de formats que les trois acceptés, ffprobe n'est pas dans l'image. Testé sur les fichiers de `tests/fixtures/audio` de l'API Platform, mêmes durées à 0,01 s près.
- **Fichier en mémoire, pas de chemin temporaire** : `parseBody` de Hono donne déjà le fichier en mémoire, et Node n'a pas la limite de mémoire de PHP qui impose à l'API Platform de passer par le fichier temporaire. `storeAudio` prend le contenu et l'écrit par `Media.Storage.put`, comme une variante d'image ; `fingerprint` sert aux deux (`fingerprint('audio', contenu)`).
- **Stockage** : collection `articleTerms` (identifiant entier par le compteur, index unique `kind, slug`) ; l'article garde `sectionId`, `formatId`, `audioKey`, `audioFormat`, `audioDuration`, `speaker`, résolus à la lecture par le dépôt.
- **Service des fichiers** : `mediaRoutes` sert `<empreinte>.mp3|m4a|ogg` avec le `Content-Type` de l'extension et les requêtes partielles d'une seule plage (`206`, `Content-Range`, `416` hors du fichier), comme le `file_server` de Caddy pour une plage ; plusieurs plages donnent le fichier entier.
- **Admin** : sections `/admin/rubriques` et `/admin/formats` (`adminArticleTerms`, la sorte en paramètre) ; formulaire de l'article : rubrique, format, fichier audio avec le lecteur du fichier actuel (`media-src 'self'` dans la CSP de l'admin), case « Retirer le fichier audio », intervenant.

## Conséquences

- **Positives** : les deux API restent interchangeables pour le blog ; `make contract` le prouve, fichier audio servi compris (corps, plages, `Content-Range`).
- **Négatives / coûts** : ceux de l'ADR 0010 de l'API Platform, dont la lecture d'en-têtes à maintenir, ici en double (PHP et TypeScript). Un envoi de 100 Mo occupe 100 Mo de mémoire le temps de la requête. Une base de développement d'avant cette décision : `make db-reset` la recrée.
- **Suivi** : suit l'ADR 0010 de l'API Platform. Rouvrir si un autre format est demandé, ou si les envois audio deviennent assez nombreux pour justifier une lecture du corps en flux.
