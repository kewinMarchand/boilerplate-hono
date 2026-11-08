# 0013 — Vente en ligne débrayable, demande de renseignement envoyée par mail : adoption de l'ADR 0014 de l'API Platform

- **Statut** : Acceptée
- **Décideurs** : Kewin Marchand
- **Adopte** : l'[ADR 0014 de boilerplate-api-platform](https://github.com/kewinMarchand/boilerplate-api-platform/blob/main/doc/adr/0014-demande-de-renseignement-envoyee-par-mail.md) (« Vente en ligne débrayable, demande de renseignement envoyée par mail »). La décision et ses alternatives sont dans ce document, elles ne sont pas recopiées ici.
- **Complète** : l'[ADR 0005](0005-identite-du-site-administree-dans-l-api.md) (deux champs de plus dans l'identité du site). Contrat : section 27 de `boilerplates-commun/SPEC-COMMUNE.md`.

## Contexte

Le contrat public est celui de l'API Platform et `make contract` le vérifie : `salesEnabled` sur `SiteIdentity`, `product` sur `ContactMessage`, 422 sur un produit inconnu. Le contact de cette API était un transaction script sans couche application, qui enregistrait le message sans l'envoyer.

## Décision

On applique l'ADR 0014 de l'API Platform telle quelle : `salesEnabled` exposé et coché par défaut, `contactRecipient` saisi dans l'admin et jamais exposé, produit vérifié par le cas d'usage (donc seulement quand les champs de texte sont valides), message enregistré puis envoyé dans la requête, échec d'envoi journalisé sans changer la réponse 201, mêmes sujets et même corps en texte brut.

Ce qui est propre à ce dépôt :

- **Couche application du contact** : `receiveContactMessage` (équivalent de `SendContactMessage`) lève `UnknownProductError`, que la route traduit en violation sur `product` (`code: null`, comme la violation construite par le processor de l'API Platform). Le domaine compose le mail (`contactMail`) et déclare trois ports : `Products`, `Recipient` et `Mailer`. Les deux premiers sont branchés dans `database.ts`, seul fichier qui voit le catalogue et l'identité du site : le contact n'importe aucun autre module, ce que vérifient les règles d'architecture.
- **nodemailer** pour le SMTP (`MAILER_DSN` en `smtp://` ou `smtps://`, expéditeur `MAILER_FROM`), adaptateur `nodemailerMailer` en infrastructure, délais de 5 s au lieu des deux minutes par défaut : le visiteur attend la réponse pendant l'envoi. Le mailer est ajouté aux dépendances par `server.ts` ; les tests passent un faux (`FakeMailer` de `tests/integration/context.ts`, qui garde les mails ou échoue à la demande), et le test de l'adaptateur passe le transport en flux de nodemailer : aucun mail réel.
- **Journal de l'échec** : `console.error` et GlitchTip (`reporter.capture`), comme une erreur inattendue d'`onError`, sans changer la réponse.
- **Parité du serializer** : `product` absent de la réponse quand il vaut `null` (`skip_null_values`), et un `product` qui n'est pas une chaîne donne la 500 du serializer de l'API Platform, qui ne collecte pas cette erreur en violation.
- **Écart assumé** : la violation sans code tire son `type` d'une empreinte d'objet PHP côté API Platform ; ici `/validation_errors/`. Déclaré dans `contract/cases.ts`.
- **Base existante** : pas de migration ; `make db-reset` recrée l'identité des fixtures avec les deux champs.

## Conséquences

- **Positives** : les deux API envoient le même mail et servent le même contrat ; `make contract` le prouve (identité du site, demandes de renseignement, produit inconnu, produit mal typé).
- **Négatives / coûts** : une dépendance (`nodemailer`, sans dépendance transitive, 2,3 Mo sur disque, côté serveur) ; un conteneur Mailpit de plus en dev ; pas encore de liste des messages dans l'admin pour retrouver un message dont l'envoi a échoué.
- **Suivi** : suit l'ADR 0014 de l'API Platform.
