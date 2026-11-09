/**
 * Règles du domaine en anglais (ADR 0014) : la clé est le modèle français du message (RuleViolation),
 * qui sert tel quel en français. Mêmes textes que translations/violations.en.yaml de l'API Platform.
 */
export const VIOLATIONS_EN: Readonly<Record<string, string>> = {
  'Activer au moins une langue.': 'Enable at least one language.',
  "Ce format n'existe plus.": 'This format no longer exists.',
  "Ce produit n'existe plus.": 'This product no longer exists.',
  "Cet article n'existe plus.": 'This article no longer exists.',
  "Cet attribut n'existe plus.": 'This attribute no longer exists.',
  "Cette catégorie n'existe plus.": 'This category no longer exists.',
  "Cette page n'existe plus.": 'This page no longer exists.',
  "Cette rubrique n'existe plus.": 'This section no longer exists.',
  'Chaque valeur a un code et un libellé.': 'Each value has a code and a label.',
  'Code de langue invalide : « %locale% ».': 'Invalid language code: “%locale%”.',
  'Couleur invalide : « %value% ». Format attendu : #rrggbb.':
    'Invalid colour: “%value%”. Expected format: #rrggbb.',
  "Empreinte d'image invalide : « %key% ».": 'Invalid image fingerprint: “%key%”.',
  'Empreinte de fichier audio invalide : « %key% ».': 'Invalid audio file fingerprint: “%key%”.',
  'Formats acceptés : JPEG, PNG, WebP ou AVIF.': 'Accepted formats: JPEG, PNG, WebP or AVIF.',
  "L'attribut « %label% » a %max% caractères au plus.":
    'The “%label%” attribute has %max% characters at most.',
  "L'attribut « %label% » attend un nombre.": 'The “%label%” attribute expects a number.',
  "L'image doit faire au moins %min% px de large : elle fait %width% × %height% px.":
    'The image must be at least %min% px wide: it is %width% × %height% px.',
  "L'image pèse plus de 10 Mo.": 'The image is larger than 10 MB.',
  "L'intervenant compte %max% caractères au plus.": 'The speaker has %max% characters at most.',
  "La catégorie du produit n'existe pas.": 'The product category does not exist.',
  "La catégorie parente n'existe plus.": 'The parent category no longer exists.',
  'La couleur principale doit contraster à 4,5:1 au moins avec le fond clair (actuellement %ratio%:1).':
    'The primary colour must reach a contrast of at least 4.5:1 with the light background (currently %ratio%:1).',
  'La couleur secondaire ne permet pas de texte lisible dessus (au mieux %ratio%:1, 4,5:1 au minimum).':
    'The secondary colour does not allow readable text on it (at best %ratio%:1, 4.5:1 at least).',
  "La durée d'un fichier audio ne peut pas être négative.":
    'The duration of an audio file cannot be negative.',
  'La galerie compte %max% images au plus (%count% demandées).':
    'The gallery has %max% images at most (%count% requested).',
  'La rubrique %name% est utilisée par %count% articles.':
    'The %name% section is used by %count% articles.',
  'La rubrique %name% est utilisée par 1 article.': 'The %name% section is used by 1 article.',
  "La rubrique choisie n'est pas une rubrique.": 'The chosen section is not a section.',
  'La valeur « %label% » est utilisée par %count% produits.':
    'The value “%label%” is used by %count% products.',
  'La valeur « %label% » est utilisée par 1 produit.': 'The value “%label%” is used by 1 product.',
  'La valeur « %value% » est en double.': 'The value “%value%” is duplicated.',
  'Le catalogue a %max% niveaux au plus : cette place en donnerait %depth%.':
    'The catalog has %max% levels at most: this position would make %depth%.',
  'Le code « %code% » est déjà pris par un autre attribut.':
    'The code “%code%” is already used by another attribute.',
  "Le fichier audio n'a pas pu être lu.": 'The audio file could not be read.',
  'Le fichier audio pèse plus de 100 Mo.': 'The audio file is larger than 100 MB.',
  'Le fichier ne se lit pas comme un fichier audio MP3, M4A ou OGG.':
    'The file cannot be read as an MP3, M4A or OGG audio file.',
  'Le fichier ne se lit pas comme une image.': 'The file cannot be read as an image.',
  'Le format %name% est utilisé par %count% articles.':
    'The %name% format is used by %count% articles.',
  'Le format %name% est utilisé par 1 article.': 'The %name% format is used by 1 article.',
  "Le format choisi n'est pas un format.": 'The chosen format is not a format.',
  'Le slug « %slug% » est déjà pris par un autre article.':
    'The slug “%slug%” is already used by another article.',
  'Le slug « %slug% » est déjà pris par un autre format.':
    'The slug “%slug%” is already used by another format.',
  'Le slug « %slug% » est déjà pris par un autre produit.':
    'The slug “%slug%” is already used by another product.',
  'Le slug « %slug% » est déjà pris par une autre catégorie.':
    'The slug “%slug%” is already used by another category.',
  'Le slug « %slug% » est déjà pris par une autre rubrique.':
    'The slug “%slug%” is already used by another section.',
  'Le texte de remplacement est obligatoire, sauf pour une image décorative.':
    'The alternative text is required, except for a decorative image.',
  'Le type de « %label% » ne peut plus changer : il est renseigné sur %count% produits.':
    'The type of “%label%” can no longer change: it is set on %count% products.',
  'Le type de « %label% » ne peut plus changer : il est renseigné sur 1 produit.':
    'The type of “%label%” can no longer change: it is set on 1 product.',
  "Recadrée au format %ratioWidth%:%ratioHeight%, l'image doit faire au moins %minWidth% × %minHeight% px : elle fait %width% × %height% px.":
    'Cropped to %ratioWidth%:%ratioHeight%, the image must be at least %minWidth% × %minHeight% px: it is %width% × %height% px.',
  'Saisir les deux couleurs, ou aucune.': 'Enter both colours, or none.',
  'Seul un attribut de type liste a des valeurs.': 'Only a list attribute has values.',
  'Seul un attribut de type liste peut servir de filtre au catalogue.':
    'Only a list attribute can be a catalog filter.',
  "Un article a besoin d'une image.": 'An article needs an image.',
  "Un produit a besoin d'une image.": 'A product needs an image.',
  'Une catégorie ne peut pas être rangée sous elle-même ou sous une de ses sous-catégories.':
    'A category cannot be placed under itself or under one of its subcategories.',
  'Une langue est activée deux fois.': 'A language is enabled twice.',
  "« %name% » contient %count% produit(s) : les déplacer ou les supprimer d'abord.":
    '“%name%” contains %count% product(s): move or delete them first.',
  "« %name% » contient des sous-catégories : les déplacer ou les supprimer d'abord.":
    '“%name%” contains subcategories: move or delete them first.',
  "« %value% » n'est pas une valeur de l'attribut « %label% ».":
    '“%value%” is not a value of the “%label%” attribute.',
  'Un prix ne peut pas être négatif ni fractionnaire : %cents% centimes.':
    'A price can be neither negative nor fractional: %cents% cents.',
}
