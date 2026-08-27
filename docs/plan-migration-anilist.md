# Passer à AniList avant le 1er octobre

> Plan, pas exécution. Écrit le 27 août 2026, après mesure des trois API.
> **Décision prise : AniList, directement.** Les phases restent à valider une à une.

## L'échéance

**L'API publique de Jikan ferme le 1er octobre 2026.** Annoncé sur son Discord
en juin, rapporté dans l'[issue #610](https://github.com/jikan-me/jikan-rest/issues/610) :

> `Jikan public API will be discontinued on October 1, 2026.`

Les 504 qui frappent le site depuis des jours ne sont donc pas une panne dont on
peut attendre la fin. Le dépôt le confirme en creux : dernier commit le 14 juin,
dernière version publiée en novembre 2024, issue toujours étiquetée `needs
triage` un mois et demi après son ouverture, et aucun mainteneur n'a répondu à
ses six commentaires.

**Il reste cinq semaines.**

## Pourquoi AniList et pas Tenrai

[Tenrai](https://api.tenrai.org) est un clone de Jikan v4. Mesuré : ses réponses
sont **identiques champ pour champ**, les six chemins utilisés par le site
répondent `200`, CORS ouvert, aucune clé. **Changer une constante d'URL aurait
suffi** — et cette bascule a été préparée avant d'être abandonnée.

Elle a été écartée pour une raison de fond :

| | Tenrai | AniList |
|---|---|---|
| nature | **clone de ce qu'on quitte** | API d'une plateforme établie |
| marqueur adulte | aucun — liste de noms | **`isAdult` natif** |
| genres sur les recommandations | **non** *(vérifié : `entry` ne porte que `mal_id`, `url`, `images`, `title`)* | **oui** |
| quota | `429` dès la 8ᵉ requête rapide, **aucun en-tête** | `X-RateLimit-Remaining` **et** `Retry-After` |
| gouvernance | opaque, financée par dons, projet jeune | plateforme aux millions d'utilisateurs |

Tenrai reproduit **exactement le profil du service qui ferme** : communautaire,
sans gouvernance identifiée, financé par dons. Y basculer aurait réparé le site
en une heure, au prix d'une migration jetable — on l'aurait refaite ensuite.

Avec cinq semaines devant soi, autant ne la faire qu'une fois.

**Ce qui reste vrai de Tenrai** : c'est un plan de repli crédible si AniList
devait échouer en cours de route. Une URL, et le site refonctionne comme avant.

## Une nuance sur « AniList est plus optimisé »

**En volume, oui** : GraphQL ne renvoie que les champs demandés, là où REST
envoie toute la fiche.

**En nombre de requêtes, non** : AniList plafonne actuellement à **30/min**,
contre une par seconde tolérée chez Tenrai — soit deux fois moins. Sa
documentation annonce 90/min et assume la réduction, « en raison d'un état
dégradé de l'API », et la mesure confirme les 30.

Ce qui compense, c'est le groupage : recherche, classement et recommandations
tiennent **en une seule requête**. Mais c'est une compensation à gagner, pas un
acquis — mal composées, les requêtes seraient plus coûteuses qu'avant.

## Architecture : deux adaptateurs, une source active

Les deux API ne disent pas la même chose du même animé. Sur *Cowboy Bebop* :

| | Jikan / Tenrai | AniList |
|---|---|---|
| score | `8.75` (sur 10) | `86` (sur 100) |
| statut | `Finished Airing` | `FINISHED` |
| durée | `"24 min per ep"` (texte) | `24` (minutes) |
| diffusion | `"Apr 3, 1998 to Apr 24, 1999"` | `{year, month, day}` |
| genres | Action, **Award Winning**, Sci-Fi | Action, **Adventure, Drama**, Sci-Fi |

Les genres ne se recouvrent pas, et les taxonomies non plus — **78 chez
MyAnimeList, 19 chez AniList**. Les faire coexister ferait voir un score qui
change de barème et des genres qui apparaissent selon la source.

D'où : **un contrat interne unique, deux traducteurs**. Le reste de
l'application ne connaît que le contrat. Changer de source revient à changer de
traducteur.

**Pas de basculement automatique.** Il ramènerait l'incohérence qu'on vient
d'écarter et doublerait les cas d'erreur à diagnostiquer. Le choix de source
reste explicite — une constante.

Et c'est l'épisode Jikan qui justifie cet investissement : une source tierce peut
disparaître avec cinq semaines de préavis glanées dans le commentaire d'une
issue. Ce qui coûte cher, ce n'est pas de changer d'API, c'est d'avoir une
application qui épouse la forme de celle qu'on quitte.

## Ce qui est vérifié sur AniList

- `Access-Control-Allow-Origin: *` — appelable depuis un site statique ;
- **aucune clé** pour les données publiques (MyAnimeList officielle répond `403`
  sans la sienne) ;
- **`Media(idMal: 11617)` fonctionne** : on retrouve un animé par son identifiant
  MyAnimeList. **Les favoris, la liste de suivi et l'historique déjà stockés
  restent valides** — c'est ce qui rend la migration progressive plutôt que
  destructrice ;
- `X-RateLimit-Remaining` et `Retry-After` sont exposés. Notre client sait déjà
  lire `Retry-After` ; Jikan ne l'envoyait jamais, ce chemin n'a donc jamais
  servi.

## L'écart qui simplifie le code : le contenu adulte

AniList expose **`isAdult`, un booléen natif** — et il est indispensable. Sur
trois titres adultes tirés de leur catalogue, tous portent `isAdult: true`
**sans avoir « Hentai » dans leurs genres**, seulement « Ecchi ». **Notre liste
de noms les laisserait passer.** AniList n'a d'ailleurs pas d'« Erotica », le
genre même qui nous avait échappé en v1.3.

Le contrat interne doit donc exposer **un booléen**, pas une liste de genres.
`classifyAdultContent()` le fait déjà en interne ; c'est sa source qui change.

Et les recommandations d'AniList portent leurs genres **et** `isAdult` : la
limite assumée de la v1.3 — deviner le registre d'une suggestion d'après la
fiche ouverte — **disparaît**.

## Les phases

Chacune se termine sur un état livrable et vérifiable. Aucune ne casse la
précédente.

### 1 — Le contrat interne ✅ *(fait le 27 août 2026)*

Définir la forme que l'application consomme : un animé, une page de résultats,
une recommandation. La déduire de ce dont les composants ont **réellement**
besoin, pas de ce que Jikan renvoie — sans quoi le contrat épouserait la forme
d'une API qu'on quitte.

*Fini quand* : le contrat est écrit et testé, et l'adaptateur Jikan actuel le
remplit sans que les pages changent. **Bascule non faite, site inchangé.**

**Fait.** `contrat-anime.js` décrit la forme ; `contrat-anime.conformite.js`
porte la suite qu'un adaptateur doit passer — c'est là qu'est la valeur, une
description en prose n'engageant à rien. L'adaptateur Jikan la passe : **9 tests,
et aucune page n'a changé.**

Prouvée par mutation : en laissant le score sur 100, comme le ferait un
adaptateur AniList mal fini, la suite sort en *« expected 87.5 to be less than
or equal to 10 »*.

Deux décisions à connaître avant la phase 2 :

- **le contrat garde les noms de champs existants.** Les favoris, la liste de
  suivi et l'historique persistent ces objets dans `localStorage` : renommer un
  champ rendrait illisibles des données constituées par l'utilisateur. Ce n'est
  pas la forme de Jikan, c'est le sous-ensemble que l'application consomme,
  relevé dans les destructurations ;
- **la suite dure 8 secondes**, parce que le limiteur de débit réel s'applique
  aussi aux tests — `jikan.js` construit son client en dur. Le rendre injectable
  relève de la phase 3.

### 2 — L'adaptateur AniList ✅ *(fait le 27 août 2026)*

Une requête GraphQL par besoin, traduite vers le contrat : score ramené sur 10,
statuts convertis, durée et dates normalisées, `isAdult` remonté tel quel.

*Fini quand* : ses tests unitaires passent sur des réponses réelles capturées, y
compris les cas tordus — animé sans épisodes connus, sans date de fin, sans
studio.

**Fait.** La traduction vit à part, en fonctions pures — `anilist/traduction.js`
— éprouvées sur une réponse réelle capturée le 27 août : 15 tests, dont les
trois cas tordus exigés. L'adaptateur passe **la même suite de conformité que
Jikan**, et un essai contre la vraie API confirme que le score revient sous 10
et que les recommandations arrivent.

Prouvée par mutation : conversion du score retirée, la suite sort en *« expected
86 to be less than or equal to 10 »*.

Trois choses apprises en chemin :

- **AniList ne rend que des noms de genres.** Le contrat veut des identifiants,
  et les prendre chez MyAnimeList garde valides les URL déjà partagées et les
  favoris enregistrés. Croisement fait : **18 noms sur 19 coïncident** au
  caractère près. Le dernier — « Thriller » — n'a pas disparu : MyAnimeList l'a
  renommé **« Suspense »**, identifiant `41` inchangé ;
- **la description d'AniList contient du HTML.** L'application n'injecte jamais
  de HTML — `dangerouslySetInnerHTML` n'apparaît nulle part — donc ce n'est pas
  une faille, mais sans nettoyage un visiteur lirait « `<br>` », et la balise de
  description de la page porterait le même bruit ;
- 🔴 **les images viennent de `s4.anilist.co`**, non de `cdn.myanimelist.net`.
  **La CSP devra l'autoriser** en phase 5, sinon aucune jaquette ne s'affichera.
  AniList sert du PNG là où MyAnimeList servait du WebP : l'écart de poids est à
  mesurer avant la bascule.

### 3 — Le débit et le cache

Caler le limiteur sur **30/min mesuré**, lire `X-RateLimit-Remaining` pour
anticiper plutôt que subir, brancher `Retry-After`.

*Fini quand* : une rafale ne provoque aucun `429`, et le cache, le secours
périmé et la déduplication fonctionnent inchangés.

### 4 — La bascule

Une constante décide de la source. AniList par défaut.

*Fini quand* : les neuf parcours et le garde-fou d'accessibilité passent sur
AniList. **Prouvé par mutation** : forcer la source sur Jikan doit les faire
passer tout autant — sinon le contrat fuit.

### 5 — Ce que l'utilisateur verra

Le sélecteur de genres passera de 78 à 19 entrées. Les scores changeront de
barème si la conversion est mal faite. L'attribution en pied de page et dans les
mentions légales doit citer AniList — et les messages d'erreur nomment « l'API
Jikan » à six endroits.

*Fini quand* : la QA visuelle est faite, et le changelog dit ce qui change pour
un visiteur.

## Les risques, et ce qui reste incertain

**Les catalogues ne sont pas identiques.** AniList et MyAnimeList n'ont ni les
mêmes entrées ni les mêmes découpages de saisons. Un animé présent dans les
favoris pourrait ne pas exister côté AniList. `idMal` couvre le cas courant,
**pas tous les cas** — à mesurer sur un échantillon avant la phase 4.

**Les 30/min peuvent bouger.** Lire `X-RateLimit-Limit` à chaque réponse plutôt
que de coder la valeur en dur.

**GraphQL déplace la complexité.** Une requête mal composée rapatrie beaucoup
trop de données. Le budget de poids ne le verra pas : il mesure le bundle, pas
le réseau.

**La qualité des données n'est pas évaluée.** Descriptions, images, traductions
diffèrent ; seule une comparaison sur un échantillon tranchera.

**L'échéance est ferme.** Si les phases prennent du retard, le repli Tenrai
reste disponible — une constante d'URL, et le site refonctionne.

## Ce qui ne change pas

Le cache et son secours périmé, le limiteur, la déduplication, le mode dégradé,
les quatre garde-fous, le dispositif de censure dans son principe. Ce sont des
briques indépendantes du format : écrites pour une API, elles serviront pour
l'autre.

## Ce que ce plan ne recommande pas

Interroger les deux sources en parallèle. Ce serait doubler le trafic pour
produire des données hybrides, incohérentes et impossibles à mettre en cache.

Attendre que Jikan se rétablisse. Elle ne se rétablira pas : elle ferme.
