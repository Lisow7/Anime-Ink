# Quitter Jikan : Tenrai d'abord, AniList ensuite

> Plan, pas exécution. Écrit le 27 août 2026, après mesure des trois API.
> Rien n'est engagé tant qu'il n'est pas validé.

## 🔴 L'échéance qui commande tout

**L'API publique de Jikan ferme le 1er octobre 2026.** Annoncé sur leur Discord
en juin, rapporté dans l'[issue #610](https://github.com/jikan-me/jikan-rest/issues/610) :

> `Jikan public API will be discontinued on October 1, 2026.`

Les 504 qui nous occupent depuis des jours ne sont donc pas une panne à attendre :
c'est un service en fin de vie. **Il reste cinq semaines.** Le dépôt le confirme
en creux — dernier commit le 14 juin, dernière version publiée en novembre 2024,
et l'issue porte encore le label `needs triage` un mois et demi après son
ouverture.

Ce plan se lit donc en deux temps : **ce qu'il faut faire avant octobre**, et ce
qui reste souhaitable après.

## Temps 1 — Tenrai, parce que c'est presque gratuit

Deux commentateurs de l'issue #610 ont basculé sur **Tenrai** en signalant que
« c'est juste une URL à changer ». **Vérifié — ils ont raison.**

Sur `/anime/1/full`, les deux réponses sont **identiques champ pour champ** :
même titre, même score `8.75`, même statut `Finished Airing`, même durée
`"24 min per ep"`, mêmes genres, même structure d'images, même chaîne de
diffusion. Et les six endpoints que le site utilise répondent **200**, y compris
`/anime?q=` et `/top/anime` — ceux-là mêmes qui échouent chez Jikan.

| | valeur |
|---|---|
| base | `https://api.tenrai.org/v1` |
| CORS | `access-control-allow-origin: *` |
| clé | aucune |
| compatibilité annoncée | 95 % des endpoints de Jikan v4 |

**Ce que ça coûte** : changer une constante d'URL, revérifier les parcours, et
mettre à jour l'attribution. Rien de plus, à ce stade de la mesure.

### Ce qu'il faut savoir avant de s'y fier

- **Le débit est strict et aveugle.** Mesuré : `429` dès la **8ᵉ** requête rapide,
  et **aucun en-tête** `X-RateLimit-*` ni `Retry-After` — exactement l'angle mort
  de Jikan. Notre limiteur devra être recalibré empiriquement, comme il l'a été
  pour Jikan.
- **La gouvernance est opaque.** Le site dit « built by engineers », sans nommer
  personne, et le financement repose sur Patreon. C'est **la même fragilité
  structurelle que Jikan**, dont on constate aujourd'hui l'issue.
- Servi derrière Cloudflare, avec `Cache-Control: public, max-age=14400`.

Autrement dit : Tenrai éteint l'incendie, il ne supprime pas le risque.

## Temps 2 — AniList, parce que le risque, lui, demeure

AniList n'est pas un service communautaire de plus : c'est l'API d'une plateforme
établie, avec des millions d'utilisateurs et un modèle qui ne repose pas sur des
dons. Passer de Jikan à Tenrai, c'est changer de cheval ; passer à AniList, c'est
changer de monture.

**Et l'épisode qu'on vient de vivre est l'argument décisif pour le contrat
interne** : une source tierce peut disparaître avec cinq semaines de préavis
glanées dans le commentaire d'une issue. Ce qui coûte cher, ce n'est pas de
changer d'API — c'est d'avoir une application qui épouse la forme de celle qu'on
quitte.

## La question posée : une API ou deux ?

**Deux adaptateurs, une seule source active à la fois.** C'est la réponse courte,
et elle tient en trois constats mesurés.

Les deux API ne disent pas la même chose du même animé. Sur *Cowboy Bebop* :

| | Jikan (MyAnimeList) | AniList |
|---|---|---|
| score | `8.75` (sur 10) | `86` (sur 100) |
| statut | `Finished Airing` | `FINISHED` |
| durée | `"24 min per ep"` (texte) | `24` (minutes) |
| diffusion | `"Apr 3, 1998 to Apr 24, 1999"` (texte) | `{year, month, day}` |
| genres | Action, **Award Winning**, Sci-Fi | Action, **Adventure, Drama**, Sci-Fi |

**Les genres ne sont pas les mêmes** — ni les valeurs, ni la taxonomie : MAL en
compte 78, AniList 19. Faire fonctionner les deux **en même temps** ferait donc
voir à l'utilisateur un score qui change de barème et des genres qui
apparaissent ou disparaissent selon la source interrogée. C'est une incohérence
qu'aucun cache ne rattrape.

D'où l'architecture : **un contrat interne unique**, deux traducteurs. Le reste
de l'application — pages, cache, limiteur, censure — ne connaît que le contrat.
Changer de source revient à changer de traducteur, pas à réécrire l'application.

**Et le basculement automatique ?** Prévu par l'architecture, mais **à ne pas
activer d'emblée** : mélanger deux sources dans une même session ramène
exactement l'incohérence qu'on vient d'écarter, et double les cas d'erreur à
diagnostiquer. Le choix de source doit rester explicite. Si Jikan redevient
fiable, on rebascule en changeant une constante.

## Ce qui est mesuré, et qui fonde ce plan

**AniList est utilisable telle quelle depuis un site statique** — c'est le
critère décisif, GitHub Pages n'ayant pas de back-end pour cacher un secret :

- `Access-Control-Allow-Origin: *` — appelable depuis le navigateur ;
- **aucune clé** pour les données publiques ;
- **`Media(idMal: 11617)` fonctionne** : on retrouve un animé par son identifiant
  MyAnimeList. Les favoris, la liste de suivi et l'historique déjà stockés
  restent valides. C'est ce qui rend la migration progressive plutôt que
  destructrice.

**Le débit est lisible, contrairement à Jikan :**

| | Jikan | AniList |
|---|---|---|
| limite annoncée | 3/s et 60/min | 90/min |
| limite **réelle mesurée** | ~1/s soutenu | **30/min** (`X-RateLimit-Limit`) |
| quota restant | *aucun en-tête* | `X-RateLimit-Remaining`, exposé via CORS |
| `Retry-After` sur 429 | **jamais envoyé** | envoyé |

Les 30/min sont une **réduction temporaire assumée par AniList**, « en raison
d'un état dégradé de l'API » — leur documentation le dit, et la mesure le
confirme. Se caler sur 30, pas sur 90 : c'est la même leçon que Jikan, dont la
doc annonçait 3/s pour un débit soutenu réel d'environ 1/s.

Trente par minute contre soixante paraît moins généreux. En pratique GraphQL
compense : recherche, classement et recommandations tiennent **en une seule
requête**, là où REST en demande trois.

## L'écart qui change la conception : le contenu adulte

C'est le point le plus important de ce plan, et il **simplifie** le code
existant.

AniList expose **`isAdult`, un booléen natif**. Et il est indispensable : sur
trois titres adultes tirés de leur catalogue, tous portent `isAdult: true`
**sans avoir « Hentai » dans leurs genres** — seulement « Ecchi ». Se fier aux
noms, comme nous le faisons aujourd'hui, **laisserait passer ces trois-là**.

| | MyAnimeList | AniList |
|---|---|---|
| genres au total | 78 | 19 |
| genres explicites | Ecchi, Erotica, Hentai | Ecchi, Hentai (**pas d'Erotica**) |
| marqueur fiable | *aucun* — d'où notre liste de noms | **`isAdult`** |

Conséquence : le contrat interne doit exposer **un booléen**, pas une liste de
genres. `classifyAdultContent()` le fait déjà en interne ; c'est sa source qui
change. Et les recommandations d'AniList portent leurs genres **et** `isAdult` —
ce que Jikan ne joint pas. **La limite assumée de la v1.3 disparaît** : plus
besoin de deviner le registre d'une suggestion d'après la fiche ouverte.

## Les phases

**Phase 0 — Tenrai, avant le 1er octobre.** Changer la base d'URL, recalibrer le
limiteur sur le débit mesuré, revérifier les neuf parcours, mettre à jour
l'attribution. C'est la seule phase qui a une échéance, et elle est indépendante
de tout le reste : elle se fait avec ou sans la suite.

*Fini quand* : les neuf parcours et le garde-fou d'accessibilité passent sur
Tenrai, et une rafale ne déclenche plus de `429`.

Les phases suivantes n'ont pas d'échéance. Chacune se termine sur un état
livrable et vérifiable ; aucune ne casse la précédente.

### 1 — Le contrat interne

Définir la forme que l'application consomme : un animé, une page de résultats,
une recommandation. Le déduire de ce dont les composants ont **réellement**
besoin, pas de ce que Jikan renvoie — sans quoi le contrat épouserait la forme
d'une API qu'on veut quitter.

*Fini quand* : le contrat est écrit et testé, et l'adaptateur Jikan actuel le
remplit sans que les pages changent. **La bascule n'a pas encore eu lieu, et le
site fonctionne exactement comme avant.**

### 2 — L'adaptateur AniList

Une requête GraphQL par besoin, traduite vers le contrat : score ramené sur 10,
statuts convertis, durée et dates normalisées, `isAdult` remonté tel quel.

*Fini quand* : les tests unitaires de l'adaptateur passent sur des réponses
réelles capturées, y compris les cas tordus — animé sans épisodes connus, sans
date de fin, sans studio.

### 3 — Le débit et le cache

Recaler le limiteur sur **30/min mesuré**, lire `X-RateLimit-Remaining` pour
anticiper plutôt que subir, et brancher `Retry-After` — que notre client sait
déjà lire mais que Jikan n'envoyait jamais.

*Fini quand* : une rafale de requêtes ne provoque aucun 429, et le cache, le
secours périmé et la déduplication fonctionnent inchangés.

### 4 — La bascule

Une constante décide de la source. AniList par défaut, Jikan disponible.

*Fini quand* : les neuf parcours passent sur AniList, et le garde-fou
d'accessibilité aussi. **Prouvé par mutation** : forcer la source sur Jikan doit
faire passer les tests tout autant — sinon le contrat fuit.

### 5 — Ce que l'utilisateur verra

Le sélecteur de genres passera de 78 à 19 entrées. Les scores changeront de
barème à l'affichage si la conversion est mal faite. L'attribution en pied de
page et dans les mentions légales doit citer AniList.

*Fini quand* : la QA visuelle est faite sur les deux sources, et le changelog
dit ce qui change pour un visiteur.

## Les risques, et ce qui reste incertain

**Le catalogue n'est pas le même.** AniList et MyAnimeList n'ont ni les mêmes
entrées, ni les mêmes découpages de saisons. Un animé présent dans les favoris
d'un utilisateur pourrait ne pas exister côté AniList. `idMal` couvre le cas
courant, **pas tous les cas** — à mesurer sur un échantillon avant la phase 4.

**Les 30/min peuvent redevenir 90, ou baisser encore.** Lire
`X-RateLimit-Limit` à chaque réponse plutôt que de coder la valeur en dur.

**GraphQL déplace la complexité.** Une requête mal composée peut rapatrier
beaucoup trop de données. Le budget de poids ne le verra pas — il mesure le
bundle, pas le réseau.

**Ce plan ne dit rien de la qualité des données.** Descriptions, images,
traductions : elles diffèrent, et seule une comparaison sur un échantillon
tranchera.

## Ce qui ne change pas

Le cache et son secours périmé, le limiteur, la déduplication, le mode dégradé,
les quatre garde-fous, le dispositif de censure dans son principe. Ce sont des
briques indépendantes du format : elles ont été écrites pour une API, elles
serviront pour l'autre.

## Ce que ce plan ne recommande pas

Interroger les deux sources en parallèle pour comparer ou compléter. Ce serait
doubler le trafic pour produire des données hybrides, incohérentes et
impossibles à mettre en cache proprement.

Attendre que Jikan se rétablisse. Elle ne se rétablira pas : elle ferme.

## En résumé

| | quand | coût | ce que ça règle |
|---|---|---|---|
| **Tenrai** | **avant le 1er octobre** | une URL, un limiteur recalibré | la panne **et** la fermeture |
| contrat interne | ensuite | moyen | rend le prochain changement bon marché |
| **AniList** | ensuite | réécriture de la couche réseau | la dépendance à un service communautaire, `isAdult` natif, quota lisible |

Le premier est urgent et presque gratuit. Les deux autres sont des choix de fond,
que l'épisode Jikan rend simplement plus faciles à justifier.
