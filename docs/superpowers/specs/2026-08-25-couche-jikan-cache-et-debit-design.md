# Couche Jikan — cache, déduplication et respect du débit

Conception validée le 2026-08-25. Base : `main` @ `a95e8c1`.

## Contexte

Les PR #14 et #15 ont déjà bâti l'essentiel de la couche réseau : point de
passage unique `requestJson`, `JikanError` typée, contrôle de `response.ok`,
retry sur 429/5xx avec lecture de `Retry-After`, délai de garde de 8 s,
espacement global de 350 ms, santé de l'API dérivée du client
(`subscribeApiHealth`), Vitest et CI `quality.yml`.

Ce lot ne refait rien de tout cela. Il traite ce qui reste, et que la mesure
désigne sans ambiguïté : **l'application ne mémorise aucune réponse et sa
politique de retry produit elle-même le rate-limit qu'elle est censée
absorber.**

## Faits établis

### Contraintes de l'API (spec OpenAPI officielle)

| Élément | Valeur |
| --- | --- |
| Débit | 3 req/s · **60 req/min** · pas de limite quotidienne |
| Cache serveur | 24 h |
| Erreurs | corps JSON `{status, type, message}` sur 400/404/429/500/503 |
| CORS | `access-control-allow-origin: *` |

### Forme réelle du plafond de débit — mesurée, non déduite

70 requêtes espacées de 400 ms (soit 150/min tentées) sur `/anime/1/full`,
endpoint servi par le cache de Jikan :

```
70 requêtes en 28,0 s          200 : 30    429 : 40
premier 429 à la requête n° 4
```

Les 429 n'apparaissent pas au voisinage de la 60ᵉ requête : ils commencent à
la quatrième, puis reviennent à cadence régulière. **30 succès en 28 s, soit
≈64 par minute.**

C'est la signature d'un **seau à jetons** : capacité de rafale ≈ 3,
réapprovisionnement ≈ 1 jeton par seconde. Les deux chiffres de la
documentation ne sont pas deux limites distinctes mais les deux paramètres du
même seau — « 3/s » en est la capacité, « 60/min » le débit de recharge.

Ce point conditionne toute la conception ci-dessous, et il est mesuré plutôt
que repris de la documentation : le plafond soutenu réel est de **1 requête par
seconde**, non de 3. `MIN_REQUEST_INTERVAL_MS = 350` vise 171 req/min contre 60
rechargées. L'application n'y échappe aujourd'hui que parce qu'elle demande peu
de choses à la fois.

### Mesures sur `api.jikan.moe` (2026-08-25)

1. **Le cache HTTP du navigateur est inexploitable.** `/anime/{id}/full`
   renvoie `Cache-Control: public, s-maxage=86400` — `s-maxage` ne s'adresse
   qu'aux caches partagés, le navigateur l'ignore — et un en-tête `expires`
   daté **dans le passé**. `/anime/{id}` renvoie
   `must-revalidate, private, pragma: no-cache, expires: -1`. Aucun `ETag`
   n'est servi, contrairement à ce qu'annonce la documentation. La validation
   conditionnelle est donc hors jeu, et un cache applicatif est le seul
   mécanisme de cache disponible.
2. **Les réponses 429 ne portent aucun `Retry-After`.** Le code lit cet
   en-tête et retombe correctement sur un backoff exponentiel ; la branche
   `Retry-After` n'est simplement jamais empruntée en pratique.
3. **La racine `/v4` répond systématiquement `504`** (3 essais espacés). Sans
   objet depuis la PR #14, qui a supprimé le sondage du pied de page ;
   consigné pour mémoire.

### Ligne de base applicative (build de production, `npm run preview`)

Parcours accueil → catalogue → accueil, sans rechargement :

| Écran | Requêtes | Résultat |
| --- | --- | --- |
| Accueil | `/top/anime` ×1 | 200 |
| | `/random/anime` ×3 | 504, 504, **429** |
| Catalogue | `/anime?…` ×3 | 504, 504, 504 |
| | `/genres/anime` ×1 | 200 |
| Retour accueil | `/top/anime` ×1 | 200 — **refetch** |
| | `/random/anime` ×3 | 504, 504, **429** |

**12 requêtes HTTP pour 6 appels logiques, dont 7 en échec.** Trois
enseignements :

- Le retour sur l'accueil refait `/top/anime` alors que la réponse datait de
  trente secondes. Aucune réponse n'est mémorisée.
- Chaque appel qui échoue est **triplé** (`retries = 2`).
- Deux fois de suite, la séquence de retry se **termine sur un 429**.

Sur ce dernier point, une réserve d'honnêteté : ces deux 429 précis ne sont pas
imputables avec certitude à l'application, car mes propres mesures partageaient
l'adresse IP et donc le même seau. Ce qui est en revanche établi sans mesure
supplémentaire, à partir du modèle de seau prouvé plus haut : la séquence de
retry émet **3 requêtes en ≈1,35 s** (t≈0, +850 ms, +1350 ms), soit 2,2/s
contre 1 jeton/s de recharge. Elle ne peut aboutir que depuis un seau
quasiment plein. Dès qu'une autre requête est en cours — et l'accueil lance
`/top/anime` et `/random/anime` de front — elle épuise le seau et se termine
en 429. Le mécanisme est démontré ; c'est lui qui justifie la correction, pas
l'anecdote des deux relevés.

La double invocation des effets par React StrictMode, visible en `npm run dev`,
est absente du build de production : elle est écartée du diagnostic.

## Écarts restants

| # | Écart | Effet mesuré |
| --- | --- | --- |
| 1 | `requestJson` ne mémorise aucune réponse | refetch à chaque navigation |
| 2 | Aucune déduplication des requêtes en vol | appelants concurrents dupliqués |
| 3 | 350 ms ⇒ 171 req/min tentées, contre 60 rechargées (mesuré) | 429 dès que plusieurs appels se croisent |
| 4 | Retry à 2,2 req/s, au-dessus de la recharge ; aucun cache négatif | l'échec est retenté 3 fois trop vite, puis refait à la navigation suivante |
| 5 | BFS de `getAnimeSeasons` non borné, `Map` locale recréée à chaque appel, `setTimeout(400)` redondant | ~750 ms par saison, franchise recalculée pour chaque animé |
| 6 | Aucun test ne couvre le débit, le cache ni la déduplication | le garde-fou est aveugle sur ce lot |
| 7 | `AnimeDetail` redirige vers `/404` sur toute erreur non-abort | une panne passagère affiche « animé introuvable » |

## Conception

### Modules

Le point de passage `requestJson` reste l'unique porte de sortie. Deux briques
autonomes s'y greffent, chacune testable isolément :

- `src/services/jikan/rate-limiter.js` — **seau à jetons** calqué sur le modèle
  mesuré : capacité 3, recharge d'un jeton par seconde. File FIFO. Expose
  `schedule(signal)`. Un seul paramétrage, pas deux fenêtres à tenir
  cohérentes : c'est la forme que l'API applique réellement.
- `src/services/jikan/cache.js` — `Map` LRU en mémoire, miroir dans
  `sessionStorage`, TTL par motif d'URL, tolérant à la saturation du quota.

`src/services/jikan.js` conserve toutes ses signatures publiques.

### Pourquoi `sessionStorage` et non `localStorage`

`localStorage` porte déjà les favoris, la watchlist, l'historique et le cache
de traductions — des données irremplaçables dans un quota de 5 Mo partagé. Y
ajouter un cache de réponses ferait courir à ces données un risque de
saturation, pour un bénéfice jetable. Conséquence assumée : **la persistance
réelle ne dépasse pas la session d'onglet.** Les TTL ci-dessous bornent la
fraîcheur, ils ne promettent pas une durée de conservation.

### Durées de validité

| Ressource | TTL |
| --- | --- |
| `/anime/{id}/full`, `/anime/{id}/recommendations` | 24 h |
| `/genres/anime` | 7 j |
| `/top/anime`, `/anime?…` | 1 h |
| `/random/anime` | jamais mis en cache |
| Échec 429/5xx (cache négatif) | 30 s |

Le cache négatif évite l'acharnement sur une API en panne : un échec sur
`/top/anime` ou `/anime?…` n'est plus rejoué pendant 30 secondes.

**Deux exclusions, à ne pas oublier :**

- `/random/anime` n'est **jamais** mis en cache, ni en succès ni en échec. Le
  mettre en cache négatif rendrait le bouton « autre animé »
  (`Home.jsx:250`) inerte pendant 30 secondes, sans le moindre retour visuel —
  précisément au moment où l'utilisateur le presse parce que rien ne s'affiche.
- Toute action explicite de l'utilisateur (bouton de reprise, rafraîchissement)
  contourne le cache négatif. `requestJson` accepte pour cela une option
  `bypassCache`, que seuls les gestionnaires d'événements utilisateur passent.
  Un cache qui ignore un clic délibéré est une régression, pas une
  optimisation.

### Ordre des opérations dans `requestJson`

1. Lecture du cache — succès comme échec récent.
2. Déduplication : une `Map` de promesses en cours, clé = chemin. Un second
   appelant reçoit la promesse existante.
3. `schedule()` — attente d'un jeton de débit.
4. `fetch`, délai de garde inchangé (8 s).
5. Classification et retry, selon la logique existante, avec un backoff
   démarrant à **2 s** au lieu de 500 ms. Le seau garantit déjà un espacement
   d'une seconde ; un backoff plus court que la recharge ne laisserait jamais
   le seau se reconstituer, et c'est exactement le défaut actuel. La lecture de
   `Retry-After` est conservée — l'en-tête est absent en pratique, mais rien
   n'oblige Jikan à ne jamais l'envoyer.
6. Écriture du cache, publication de l'état de santé.

L'annulation (`AbortSignal`) est propagée telle quelle et n'écrit jamais dans
le cache.

**Piège de conception à traiter explicitement.** `requestJson` transmet
aujourd'hui le `signal` de l'appelant au `fetch` via `timeoutController`. Dès
lors qu'une requête est partagée entre plusieurs abonnés, elle ne doit plus
porter le signal d'un appelant particulier : sinon l'annulation d'une recherche
obsolète dans `Catalogue` — qui abandonne à chaque frappe, via son `debounce` —
avortera la requête que les autres abonnés attendent. Le `fetch` partagé ne
porte que son propre délai de garde ; chaque abonné voit son abandon converti
en `AbortError` local, et la requête n'est réellement interrompue que si tous
les abonnés se sont désistés. `Catalogue` est un chemin d'annulation vivant :
c'est ce cas-là, et non un cas théorique, que le test doit couvrir.

### `getAnimeSeasons`

- Plafonner le BFS à 6 saisons et 12 requêtes, quel que soit le graphe.
- Supprimer le `setTimeout(400)` interne : le limiteur global fait ce travail.
- Router `fetchFull` par le cache partagé, afin qu'une franchise déjà
  parcourue ne coûte plus rien — c'est le cas fréquent dans une watchlist.

### `AnimeDetail`

Distinguer `error.status === 404` — qui justifie `/404` — de toute autre
`JikanError`, qui doit afficher un état « service indisponible » avec un
bouton de reprise, sur le modèle déjà en place dans `Catalogue.jsx`.

## Tests

Vitest, faux timers, en complément des 15 tests existants :

- débit : 10 appels ⇒ au plus 3 dans la première seconde, au plus 60 sur une
  minute glissante ;
- déduplication : 2 appels concurrents sur le même chemin ⇒ 1 seul `fetch` ;
- cache : second appel avant expiration ⇒ 0 `fetch` ; après expiration ⇒ 1 ;
- cache négatif : un 504 puis un rappel immédiat ⇒ 0 `fetch` supplémentaire ;
- annulation partagée : deux abonnés sur le même chemin, le premier abandonne
  ⇒ le second reçoit bien sa réponse (cas réel de `Catalogue`) ;
- `bypassCache` : un échec mis en cache négatif est bien rejoué lorsque
  l'appelant passe l'option ;
- `sessionStorage` saturé ⇒ dégradation en mémoire seule, sans exception.

**Preuve par mutation, obligatoire avant de déclarer le lot fini.** Chaque
garde-fou doit être vu tomber : retirer le limiteur et constater l'échec du
test de débit ; retirer la déduplication et constater l'échec du test associé ;
puis rétablir. Un test qui passe sans avoir jamais échoué ne prouve rien.

## Critère de réussite

Un comptage brut de requêtes mesurerait l'humeur de MyAnimeList autant que le
travail fait : tant que l'API renvoie des 504, chaque appel logique en échec
coûte encore 3 requêtes (`retries = 2` reste inchangé). Le critère porte donc
sur deux grandeurs insensibles à l'état de l'amont :

1. **Rapport appels logiques → requêtes HTTP, API en bonne santé.** Même
   parcours accueil → catalogue → accueil : 6 appels logiques, **4 requêtes
   attendues** (`/top/anime`, `/random/anime`, `/anime?…`, `/random/anime`) —
   `/genres/anime` venant du cache existant et la seconde visite de l'accueil
   ne coûtant rien.
2. **Requêtes évitées par le cache au retour sur l'accueil : `/top/anime` doit
   valoir zéro requête.** Cette moitié-là teste exactement le travail livré et
   ne dépend d'aucune condition extérieure.

Aucune séquence de retry ne doit par ailleurs émettre plus de 1 requête par
seconde, ce que le test de débit vérifie indépendamment du réseau.

## Résultats constatés (2026-08-25, build de production)

Mesure faite alors que **l'API renvoyait encore des 504** sur `/random/anime` et
`/anime?…`. Cette réserve conditionne la lecture de ce qui suit.

| Vérifié | Preuve |
| --- | --- |
| Le retour sur l'accueil ne coûte plus rien | `/top/anime` : **2 requêtes → 1** sur le parcours accueil → catalogue → accueil |
| Plus aucune séquence de retry ne finit en 429 | 0 réponse 429, contre 2 séquences auparavant |
| Une panne n'affiche plus « animé introuvable » | 503 forcé sur `/anime/1/full` : l'URL reste sur la fiche, `role="alert"`, bouton de reprise |
| Le bouton de reprise repart au réseau | 3 appels réseau comptés après le clic, l'échec mémorisé n'a pas répondu |
| Le voyant de santé dit vrai | « API indisponible » affiché pendant que l'API renvoyait réellement des 504 |

**Non vérifié :** le critère n° 1 — 6 appels logiques pour 4 requêtes, API en
bonne santé. Aucune fenêtre de bonne santé ne s'est présentée. Le total observé
(12 → 8 requêtes) ne doit pas en tenir lieu : il reste gonflé par trois appels
en échec que la politique de retry triple, ce qui relève de l'amont et non de ce
lot. À rejouer quand MyAnimeList répondra normalement.

Suite de tests : **46 tests**, dont 28 sur la nouvelle couche. Sept garde-fous
ont été prouvés par mutation. Deux d'entre eux étaient **aveugles** au premier
essai — le faux réseau du test d'annulation partagée n'honorait pas le signal,
puis n'échouait pas sur un signal déjà annulé, comme le fait un vrai `fetch`.
Sans la discipline de mutation, ces deux tests seraient passés pour verts en ne
vérifiant rien.

Un défaut de robustesse a été trouvé au passage et corrigé : le seau se figeait
si l'horloge reculait (ajustement NTP, changement d'heure), attendant que
l'heure réelle rattrape son retard avant de délivrer le moindre jeton.

## Hors périmètre

Renvoyés au lot suivant : `sfw`, `min_score`, `genres_exclude` ; redondance
probable entre `getAnimeFranchise` et les `relations` déjà fournies par
`/full` ; `translate.js` et la déclaration RGPD de MyMemory, tiers absent des
mentions légales ; `Content-Security-Policy` ; pré-rendu SEO.

## Dette de process constatée

`origin/dev` a **10 commits de retard** sur `origin/main` et n'en contient
aucun qui lui soit propre. Le README prescrit pourtant de brancher depuis
`dev` : appliqué tel quel aujourd'hui, cela ferait perdre les PR #14 et #15.
Cette branche part donc de `main`. Il faut aligner `dev` sur `main` avant de
reprendre le flux normal.
