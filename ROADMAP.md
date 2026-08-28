# Feuille de route — Anime-Ink

> État au 27 août 2026. **v1.5 en production** : https://lisow7.github.io/Anime-Ink/
>
> Ce document sépare ce qui est **vérifié** de ce qui reste à faire. Une première
> version de cette liste vivait dans la branche `perf/jikan-cache-deduplication`
> (PR #22, fermée) : elle annonçait comme livrées deux choses qui ne l'étaient
> pas. Chaque ligne ci-dessous a été relue dans le code avant d'être écrite.

## Livré et vérifié

### Couche Jikan

- **Débit calé sur les limites officielles** : seau à jetons, rafale de 3,
  recharge d'un jeton par seconde — soit exactement les 3 req/s et 60 req/min
  documentés. Vérifié en provoquant un vrai `429`, qui tombe à la 4ᵉ requête.
- **Cache applicatif** : LRU de 200 entrées, miroir `sessionStorage`, durées par
  ressource (`ttl.js`). Le cache HTTP du navigateur est inexploitable —
  `s-maxage` seul, `expires` daté dans le passé, et **pas d'`ETag` malgré ce
  qu'annonce la documentation de Jikan**. `If-Modified-Since` fonctionne, lui,
  mais n'économise que des octets, pas des requêtes.
- **Déduplication des requêtes en vol** : plusieurs composants demandant la même
  URL n'en déclenchent qu'une, annulée seulement quand le dernier abonné se
  retire.
- **Nouvelles tentatives** sur `429/500/502/503/504`, avec un délai de 2 s
  doublant jusqu'à 10 s — plus long que la recharge du seau, sinon les reprises
  finissaient elles-mêmes en `429`.
- **Mode dégradé** : chaque écran distingue une panne d'un résultat vide, et
  propose de réessayer. Un `404` n'est plus confondu avec un `5xx`.
- **Filets locaux** : liste des genres (`localStorage`) et traductions (100
  entrées, 30 jours) survivent à une panne.
- **Appels en cascade bornés** : 6 saisons, 12 recherches au maximum.
- **Voyant d'état** dérivé des appels réels, sans requête supplémentaire.

### Contenu adulte

- Les **trois** genres explicites de MyAnimeList sont couverts — `Ecchi`,
  `Erotica`, `Hentai`. `Erotica` manquait : 95 animés s'affichaient en clair.
- Toutes les surfaces de découverte floutent : grille, vue liste, animé surprise,
  suggestions de recherche, liste de suivi, suggestions « Vous aimerez aussi ».
- La **fiche** ouverte depuis un lien partagé avertit avant d'afficher, avec un
  bouton qui révèle **et** permet de remasquer.
- Le sélecteur de genres masque les genres explicites tant que la censure est
  active, et lève un filtre explicite déjà posé.

### Garde-fous

- **Accessibilité** : axe-core dans un vrai navigateur, **30 scénarios** (5
  routes, 2 thèmes, bureau et mobile, modales ouvertes, états d'échec,
  avertissement de contenu), à chaque pull request.
- **Couverture du filtre d'âge** : toute surface affichant une jaquette doit
  classer son contenu. Aucune exemption.
- **Parcours utilisateur** : 7 scénarios dans un vrai navigateur — recherche,
  filtres et leur persistance dans l'URL, favoris avec et sans consentement,
  mode dégradé, censure, sélecteur de genres.
- Les trois sont **prouvés par mutation** : on a vérifié qu'ils échouent quand ils
  doivent échouer.
- 65 tests unitaires sur la couche réseau et les utilitaires. Ils ne voient rien
  des pages : neutraliser le floutage d'une carte les laisse tous verts, et fait
  échouer un parcours.

### Performance

Lighthouse 100, LCP 1,7 s, CLS 0. Jaquettes en WebP, bundle découpé, `preconnect`
corrigés.

**Un budget de poids tient l'acquis** : 100,7 ko au démarrage et 138,7 ko au
total, en gzip, avec des plafonds à 3 % au-dessus. Vérifié à chaque pull request
avant même l'installation du navigateur. Les marges sont serrées à dessein — un
premier réglage à 10 % laissait passer sans un mot le retour d'une route entière
dans le chunk d'entrée.

## Annoncé à tort comme livré — instruit, et tranché

Ces deux lignes venaient de l'ancienne liste. Aucune n'est devenue une tâche :
les instruire a suffi à les régler.

**« Détecter une erreur Jikan dans une réponse `200` » — sans objet.** Deux
raisons plutôt qu'une. D'abord, le cas n'a pas pu être démontré : sollicitée
avec un identifiant absurde, une limite non numérique et une page négative,
l'API répond avec un code d'erreur, jamais `200`. Ensuite, quand bien même il
surviendrait, **tous les appelants s'en protègent déjà** — `data.data ?? []`,
`Array.isArray(json.data) ? json.data : []`, `data?.relations ?? []`. Un corps
inattendu dégrade en liste vide, et la fiche bascule sur sa page « introuvable ».
Écrire une détection ajouterait un chemin de code pour un cas que le contrat
absorbe.

**« Servir la dernière réponse valide pendant une panne » — fait, après avoir
été écarté.** Je l'avais classé « arbitrage, pas tâche » : le cache vivant en
`sessionStorage`, servir du périmé n'aide pas à l'arrivée sur un site dont l'API
est déjà tombée, puisque le cache y est vide.

Cet argument tient toujours. Ce qui a changé, c'est le poids de l'autre
scénario : **la panne de Jikan dure et va par intermittence**. Consulter le
catalogue, puis le perdre quand une durée de validité expire alors que la
réponse est là, n'est plus l'exception — c'est le cas courant. Jikan applique
d'ailleurs cette pratique à son propre cache : ses réponses portent
`X-Cache-Status: STALE` pendant les pannes de MyAnimeList.

Implémenté sous la forme du `stale-if-error` de la RFC 5861 : l'entrée périmée
n'est plus effacée mais gardée un jour en réserve, et resservie **quand le
réseau a définitivement échoué**. Réservé aux pannes — un `404` reste un `404`,
resservir une vieille copie prétendrait que la ressource existe encore.

Ce que cela ne fait pas, et ne fera pas sans changer d'avis sur le stockage :
aider une première visite pendant une panne. Le rendre possible supposerait
`localStorage`, que le projet refuse pour protéger le quota des favoris, de la
liste de suivi et de l'historique.

**Enfin, une nuance sur `Retry-After`** : sa prise en charge existe bien dans le
code, mais **Jikan n'envoie jamais cet en-tête** (mesuré sur un vrai `429`). Le
repli fait tout le travail. Ce chemin n'a donc jamais été éprouvé en conditions
réelles, et il ne faut pas le croire tel.

## Reste à faire

### Expérience

- [x] ~~progression par épisode~~ — **déjà livrée**, et depuis un moment : la
      liste de suivi retient l'épisode et la saison atteints, avec report d'une
      saison à l'autre. La ligne annonçait comme à faire ce qui tournait déjà.
- [x] ~~page « Où reprendre ? »~~ — livrée en v1.7, sur le Profil : les séries
      déclarées en cours, l'épisode atteint, et **la date du prochain épisode**
      quand la source la connaît. Une seule requête pour toute la liste
      (`idMal_in`), là où un appel par série aurait coûté un tiers du quota
      d'une minute à chaque visite ;
- [x] ~~calendrier des sorties~~ — livré en v1.9, sur le Profil, et **restreint
      à ce que le visiteur suit**. La mesure a tranché : AniList annonce
      **5 000 diffusions sur sept jours**, un calendrier du catalogue entier
      serait illisible et sans rapport avec ce que la personne regarde. La vue
      couvre donc les favoris **et** la liste de suivi — on peut mettre en
      favori sans suivre.

      ⚠️ **Une entrée par série** : la source ne donne que le *prochain*
      épisode de chaque titre, si bien qu'une série diffusée deux fois dans la
      même semaine n'apparaît qu'une fois. Lever cette limite demanderait une
      seconde opération (`airingSchedules` filtré par identifiants) pour un cas
      rare ;
- [x] ~~import/export JSON des favoris et de la liste~~ — livré en v1.8, sur le
      Profil, et étendu à l'historique. **Une restauration complète sans jamais
      remplacer** : importer une vieille sauvegarde ne peut pas faire reculer une
      progression. Le consentement, lui, n'est ni exporté ni restauré — le
      remettre depuis un fichier fabriquerait un accord que la personne n'a pas
      donné sur cette machine ;
- [x] ~~filtres par saison et par année~~ — livrés en v1.10. Le couple est le
      mode de navigation naturel de l'animation : on parle de « la saison d'été
      2026 ». Les valeurs vivent dans l'URL en français (`?saison=ete&annee=2026`)
      — ce sont elles qui se partagent — et la traduction vers la source se fait
      dans l'adaptateur. Une saison inconnue ou une année fantaisiste est
      **ignorée** plutôt que transmise : la transmettre ferait refuser la
      requête entière, et le catalogue afficherait une erreur là où il devrait
      simplement ne pas filtrer.
- [x] ~~filtre par durée~~ — livré en v1.13, en **tranches** et non en minutes :
      personne ne cherche « les animés de 22 minutes », on cherche un format —
      une série courte, un épisode classique, un film. Vérifié contre la source :
      les trois tranches rendent 4-6 min, 24 min et 107-130 min.
- [x] ~~filtre par studio~~ — livré en v1.15, **comme le chantier à part qu'il
      est**. AniList refuse un filtre de studio sur son catalogue (« Unknown
      argument "studio" ») : il faut passer par `studios(search:)`, dont la
      pagination est **imbriquée** dans les œuvres au lieu d'être portée par la
      page. D'où une opération dédiée et sa traduction, qui ramène le tout à la
      forme que l'écran attend.

      ⚠️ **Les autres filtres ne s'y appliquent pas** — c'est une autre requête,
      pas un critère de plus. Ils sont donc **éteints** pendant une recherche de
      studio, avec une phrase qui dit pourquoi : les laisser actifs sans effet
      aurait été le vrai défaut.

      `isMain: true` écarte les studios qui n'ont fait qu'une part du travail :
      « les animés de Bones » désigne ce qu'ils ont produit, pas ce à quoi ils
      ont prêté la main.

      Une comparaison ne juxtapose pas : elle **désigne**. La meilleure note et
      la série la plus courte sont mises en avant — sauf en cas d'égalité, où
      distinguer l'un serait arbitraire — et les **genres communs** sont
      dégagés, ce qu'aucune fiche prise isolément ne montre.

*(« Afficher la date de la dernière donnée valide en mode dégradé » a disparu de
cette liste : elle supposait qu'une donnée périmée soit servie, ce que la section
précédente écarte. Sans elle, il n'y a aucune date à montrer.)*

### Qualité

- [x] ~~valider les réponses de l'API~~ — livré le 28 août, sous une forme que
      la contrainte a dictée. **Les jeux de test sont figés** : c'est ce qui les
      rend fiables, la CI ne devant dépendre d'aucun tiers, mais cela créait un
      angle mort exact — si AniList renommait un champ, la suite de conformité
      serait passée indéfiniment pendant que l'écran se vidait. Supportable tant
      que deux sources coexistaient ; plus rien ne s'y opposait depuis qu'il n'en
      reste qu'une.

      `npm run veille` confronte la **vraie** API aux requêtes du dépôt —
      importées, jamais recopiées. GraphQL **refuse** une requête qui demande un
      champ inexistant, au lieu de l'ignorer : envoyer les vraies requêtes
      suffit donc à faire tomber le contrôle le jour où la source change de
      forme. S'y ajoutent des vérifications de sens, car un champ peut survivre
      en changeant de nature — une note qui passerait sur dix, une date qui
      passerait en millisecondes.

      ⚠️ **Hors de la CI des pull requests, délibérément** : il dépend d'un
      service extérieur, et un garde-fou qui rougit au gré de l'humeur d'un
      tiers finit ignoré — pire que pas de garde-fou. Il tourne chaque lundi et
      **ouvre une issue** en cas de rupture, un échec dans un onglet que
      personne ne consulte ne valant pas mieux que rien.

Le **poids** des bundles est tenu (voir plus haut). Les métriques de terrain,
elles, ne relèvent pas de cette section : voir ci-dessous.

### Ce que l'hébergement permet, et ce qu'il ne permet toujours pas

*(Cette section s'intitulait « Nécessite un autre hébergement ». Le déplacement
a eu lieu le 28 août 2026 : la moitié de ce qu'elle listait est réglé, et la
laisser en l'état aurait fait porter au lecteur des limites qui n'existent
plus.)*

**Réglé par le déplacement** — mesuré sur la production, pas déduit :

- ✅ les routes profondes répondent `200`, une adresse inventée garde son `404` ;
- ✅ les jaquettes sont converties en WebP : 228 ko de catalogue au lieu de
  1 084, 15 ko de fiche au lieu de 478 ;
- ✅ `frame-ancestors` et `Permissions-Policy` sont servis en en-tête, ce qu'une
  balise `<meta>` ignore.

**Ce qui reste, et pourquoi :**

- [ ] **`report-uri` / `report-to`** — recevoir les violations de la politique de
      sécurité suppose une adresse qui les collecte. C'est désormais **possible**
      (l'hébergement sait exécuter des fonctions), là où ce ne l'était pas du
      tout ; ce n'est plus une impossibilité mais un arbitrage — un point de
      collecte à écrire, à surveiller et à protéger du bruit, pour un site sans
      compte ni paiement.
- [ ] **le décalage de mise en page d'une fiche** — mesuré le 28 août sur la
      production : **0,23 sur écran large, 0,63 sur mobile**, quand 0,1 est la
      limite du tolérable. La cause est connue et n'a rien d'obscur : l'écran
      d'attente est plus court que la fiche, si bien que l'arrivée des données
      pousse tout ce qui suit.

      Deux corrections ont déjà été apportées et mesurées — un squelette qui
      reproduit la structure entière (368 → 508 pixels) et une hauteur d'écran
      réservée (0,45 → 0,23 sur large). ⚠️ **Cette dernière dégrade légèrement
      le mobile** (0,63 contre 0,61) : elle a été retenue sur l'arbitrage, pas
      par principe.

      ⛔ **Une piste a été essayée et écartée sur mesure, le 28 août.** Le
      diagnostic rapportait `MAIN` passant « de 835 à 835 pixels » tout en
      comptant 0,19 de décalage, ce qui laissait croire que le coupable était le
      **remplacement de l'arbre** — substituer la fiche au squelette — et non la
      hauteur. Rendre la structure une seule fois, remplie ensuite, devait donc
      régler l'affaire.

      Résultat : **0,23 → 0,45 sur écran large, 0,66 → 0,74 sur mobile.** La
      hauteur était bien en cause : sans squelette, la page démarre courte et
      grandit davantage. La mesure de l'API attribue le décalage au conteneur
      dont les descendants bougent, ce qui rend son « 835 → 835 » trompeur.

      🥇 **Ce qui reste à essayer part donc de l'autre bout** : faire coïncider
      la hauteur d'attente avec celle de la fiche, plutôt que supprimer
      l'attente. Cela suppose de connaître la hauteur avant d'avoir les données
      — donc de la réserver par catégorie de fiche, ou de rendre la page depuis
      le serveur. Aucune des deux n'est un réglage.

- [ ] **métriques de terrain (LCP, CLS, INP)** — également **possibles**
      désormais, l'hébergeur proposant sa propre mesure. Le frein a changé de
      nature : c'est le **poids** qui décide, le script de mesure s'ajoutant à
      ce que chaque visiteur télécharge, et le budget de démarrage n'a que
      0,9 ko de marge. À reprendre le jour où il y aura du trafic à mesurer —
      une métrique de terrain sans visiteurs ne mesure rien.

**Écarté, et non plus « à faire » :**

- ⛔ **`sandbox`** — cette directive existe pour brider du contenu **tiers**
      qu'on embarque. L'appliquer à ses propres pages les casserait, ou
      exigerait `allow-scripts allow-same-origin`, ce qui la vide de son sens.
      Elle figurait dans la liste des quatre protections manquantes par
      symétrie, jamais parce qu'elle servait à quelque chose ici.
- ⛔ **proxy de cache en périphérie** — l'hébergement en fournit un
      (`X-Vercel-Cache: HIT`, vérifié). L'item était écrit pour un hébergeur qui
      n'en avait pas.

### Ce qu'a coûté le déplacement, et ce qu'il a rapporté

*(Compte rendu. Le déplacement a eu lieu le 28 août 2026 ; ce qui suit était
l'instruction qui l'a décidé, conservée parce qu'elle porte les mesures.)*

Les limites d'alors tenaient toutes au même fait : **GitHub Pages ne sert que
des fichiers**. Ni en-tête configurable, ni réécriture, ni transformation
d'image. Instruit le 27 août 2026, sur documentation à jour :

| | GitHub Pages | Vercel | Cloudflare Pages | Netlify *gratuit* |
|---|---|---|---|---|
| Réécriture SPA en `200` | ❌ | ✅ | ✅ | ✅ |
| En-têtes HTTP | ❌ | ✅ | ✅ | ✅ |
| Conversion WebP | ❌ | ✅ | 💰 20 $/mois | ❔ crédits |
| Prix | 0 € | **0 €** | 0 € | 0 € |

**Vercel couvre les trois**, par un seul fichier
`vercel.json` — [la documentation](https://vercel.com/docs/project-configuration/vercel-json)
donne les trois clés nécessaires :

- `rewrites` : `[{ "source": "/(.*)", "destination": "/index.html" }]`, le motif
  SPA documenté, qui **garde un `200`** ;
- `headers` : de quoi poser `frame-ancestors` et `Permissions-Policy`, seuls
  absents de la balise `<meta>` ;
- `images` : `remotePatterns` autorisant `s4.anilist.co` et
  `formats: ["image/webp"]`, servi par `/_vercel/image?url=…&w=…&q=…`.
  **5 000 transformations par mois**, mises en cache après le premier appel —
  le catalogue en consomme environ mille une fois pour toutes.

💡 **Le compte est en offre Pro**, souscrite pour un autre projet : ce site en
profite **sans surcoût**, avec des quotas plus larges et sans la clause d'usage
personnel non commercial que porte l'offre gratuite. Cette page a d'abord
annoncé « Hobby », par supposition et non par vérification — les deux projets
sont distincts, mais l'abonnement, lui, se partage.

⚠️ **Ce qu'il reste à décider** : l'adresse change
(`lisow7.github.io/Anime-Ink/` → `anime-ink.vercel.app`), ce qui touche `base`
dans `vite.config.js`, le `basename` du routeur, `ORIGINE` dans `useSEO.js`, et
les liens déjà partagés — GitHub Pages peut rester en place pour rediriger.
**Chaque changement d'adresse coûte en référencement** : si un nom de domaine
propre est envisagé, mieux vaut le prendre avant et ne changer qu'une fois.

✅ **Fait, et basculé le 28 août 2026.** Le site public est désormais
**https://anime-ink-blond.vercel.app** ; GitHub Pages n'héberge plus rien et
**redirige**, en gardant le chemin, la requête et l'ancre — un lien partagé vers
`/anime/1` arrive toujours à destination.

⚠️ **Cette redirection n'est pas un `301`.** Un hébergement de fichiers ne peut
pas en émettre : c'est une balise `refresh` doublée d'un script, que les moteurs
tiennent pour un signal plus faible. Le coût est ici presque nul — les routes
profondes répondaient `404` depuis toujours, donc rien n'était indexé à
transmettre — mais il fallait le dire plutôt que de laisser croire à une
redirection propre.

🔁 **Réversible en une ligne** : les étapes de construction restent dans le
workflow de Pages, qui vérifient toujours que le site compile. Remettre
`path: dist` à la place de `path: redirection` y rétablit l'hébergement.

💡 **Un nom de domaine reste possible et ne coûtera rien en travail** :
l'origine des adresses canoniques est déterminée au build par l'hôte lui-même,
si bien qu'aucune ligne de code ne sera à changer. `anime-ink.vercel.app` est
déjà pris par un autre projet.

| | GitHub Pages | Vercel |
|---|---|---|
| Catalogue, jaquettes | 1 084 ko · PNG/JPEG | **228 ko · WebP** |
| Fiche, jaquette | 138 ko | **15 ko** |
| `/catalogue`, `/anime/1` | `404` | **`200`** |
| Adresse inconnue | `404` | `404` |
| `frame-ancestors`, `Permissions-Policy` | absents | **posés** |
| Erreurs console | un `404` | aucune |

⚠️ **Le gain avait un symétrique à éviter.** Une réécriture attrape-tout
(`/(.*)` → `index.html`) rend `200` pour **toute** adresse, y compris inventée :
c'est le *soft 404* que la documentation déconseille, et qui aurait fait passer
n'importe quelle URL pour une page valide. Seules les cinq routes réelles sont
donc réécrites ; le reste tombe sur une vraie page `404`.

Le `404.html` diffère aussi selon l'hôte : GitHub Pages a besoin de son script
de redirection — c'est lui qui fait tenir la navigation profonde — quand Vercel
doit servir une page franche. Le laisser des deux côtés aurait renvoyé une
adresse invalide en boucle vers l'application.

## Vérifications en production

### La nature de la panne, mesurée

Elle ne se répartit pas par endpoint, comme je l'ai d'abord cru, mais **par
présence dans le cache de Jikan**. Deux requêtes vers le même endpoint, à la
seconde près :

| requête | réponse | `X-Cache-Status` |
|---|---|---|
| `/anime?q=naruto` — demandée 3 min plus tôt | **200** | `STALE` |
| `/anime?q=zzqqxx-inexistant-1234` — jamais demandée | **504** | — |

Jikan sert donc son cache **même périmé**, et échoue dès qu'il doit interroger
MyAnimeList, qui refuse ses connexions. Ce qui répond n'est pas « ce qui marche »
mais « ce qu'il a déjà ».

**Cela invalide une conclusion écrite plus haut dans ce dépôt** : j'avais déduit
du `504` sur `/genres/anime?filter=…`, alors que le même endpoint sans paramètre
répondait, que **le paramètre était cassé**. C'est faux. La liste complète sort
du cache ; les variantes filtrées n'y sont pas, voilà tout.

Le choix de filtrer les genres explicites côté client **reste le bon**, mais pour
une meilleure raison : dépendre d'une requête supplémentaire ajoute un point de
défaillance, et cette panne le démontre — la liste complète survit, ses variantes
non.

Ce qui pouvait être vérifié l'a donc été, et bien au-delà de ce qu'on croyait
possible : **une seule surface reste en suspens**.

- [x] **l'avertissement de la fiche, contre du vrai contenu explicite** (27 août
      2026). Sur `/anime/11617`, *High School DxD*, genre `Ecchi` : jaquette
      floutée à 16 px, mention « Contenu réservé à un public averti », bouton
      « Afficher quand même » à `aria-expanded="false"`. **Le focus seul ne
      révèle rien** ; `Entrée` lève le flou et bascule le libellé en « Masquer la
      jaquette ». Titre et synopsis lisibles à toutes les étapes.
- [x] **cinq des six surfaces de floutage, en production** (27 août 2026), sans
      attendre le catalogue. La manœuvre vaut d'être notée : **visiter une fiche
      l'inscrit dans l'historique**, ce qui peuple l'onglet « Récents » avec de
      vraies cartes sans qu'aucune requête de catalogue soit nécessaire. De là,
      un clic ouvre la modale, et son bouton « Ma liste » alimente la liste de
      suivi.

      | Surface | mesure |
      |---|---|
      | carte de grille (`AnimeCard`) | `blur(12px)` |
      | carte en vue liste (`AnimeListCard`) | `blur(8px)` |
      | liste de suivi (`WatchlistTable`) | `blur(12px)`, dans ses deux dispositions |
      | suggestions « Vous aimerez aussi » | `blur(10px)` sur les six |
      | fiche détail | `blur(16px)` + avertissement |

      Les six recommandations sont d'autant plus concluantes qu'**aucune ne porte
      de genre** — Jikan ne les joint pas. C'est donc bien le repli sur le
      registre de la fiche ouverte qui a joué, en conditions réelles.
- [x] ~~le floutage des **suggestions de recherche**~~ — **vérifié le 28 août**,
      et c'est le changement de source qui l'a rendu possible. L'obstacle
      n'était pas le code : l'API précédente ne répondait qu'aux requêtes déjà
      dans son cache, or celle que compose une frappe n'y était jamais. Rien ne
      s'y oppose plus, et un parcours l'éprouve désormais — vignette floutée et
      registre annoncé, prouvé en retirant le floutage.

      Les **six** surfaces de floutage sont donc couvertes.

*(La ligne sur `filter=explicit_genres` a disparu d'ici : sa conclusion était
fausse. Voir « La nature de la panne » ci-dessus — le paramètre n'est pas cassé,
ses variantes ne sont simplement pas en cache.)*

## 🔴 Le cap : passer à AniList avant le 1er octobre 2026

**L'API publique de Jikan ferme.** Annoncé sur son Discord en juin, rapporté
dans l'[issue #610](https://github.com/jikan-me/jikan-rest/issues/610) :
`Jikan public API will be discontinued on October 1, 2026.` Les 504 qui frappent
le site ne sont donc pas une panne dont on peut attendre la fin.

**Décision prise le 27 août : migrer vers [AniList](https://docs.anilist.co),
directement.**

✅ **Fait le 27 août 2026 (v1.6).** Le site lit AniList.

L'adaptateur Jikan a été **retiré le 28 août**, une fois la bascule éprouvée en
production. Le garder « au cas où » revenait à maintenir, tester et documenter
un chemin de code vers un service qui ferme — et à faire porter à chaque
lecteur la question « laquelle des deux lit-on ? » pour une réponse qui ne
changeait plus.

Ce qu'il laisse derrière lui n'est pas rien : le **socle réseau** — cache,
limiteur, déduplication, secours périmé — lui survit et sert AniList sans avoir
été réécrit. C'est lui, et non l'adaptateur, qui rendra le prochain changement
de source aussi peu coûteux que celui-ci.

→ **[Plan détaillé](./docs/plan-migration-anilist.md)** — cinq phases, chacune
livrable, la bascule prouvée par mutation.

### Ce qui a été vérifié avant de décider

- `Access-Control-Allow-Origin: *` et **aucune clé** : appelable depuis un site
  statique, contrairement à l'API officielle de MyAnimeList qui répond `403` ;
- **`Media(idMal:)` retrouve un animé par son identifiant MyAnimeList** — les
  favoris, la liste de suivi et l'historique déjà stockés **restent valides** ;
- `X-RateLimit-Remaining` et `Retry-After` sont exposés, là où Jikan n'envoie
  aucun en-tête de quota ;
- **`isAdult`, booléen natif** — et indispensable : trois titres adultes le
  portent **sans** « Hentai » dans leurs genres. Notre liste de noms les
  laisserait passer. AniList n'a d'ailleurs pas d'« Erotica », le genre même qui
  nous avait échappé en v1.3. Ses recommandations portent genres **et**
  `isAdult`, ce qui lèvera la limite assumée ci-dessous.

Réserve mesurée : **30 requêtes/minute** actuellement — deux fois moins que
Jikan — réduction que la documentation d'AniList assume, elle qui annonce 90.
GraphQL compense en groupant, mais c'est une compensation à gagner.

### Tenrai, écarté — et gardé comme repli

[Tenrai](https://api.tenrai.org) est un clone de Jikan v4 : réponses **identiques
champ pour champ**, six endpoints sur six en `200`, CORS ouvert, aucune clé.
Changer une constante d'URL aurait suffi, et la bascule avait été préparée.

Écartée parce qu'elle reproduit **exactement le profil du service qui ferme** :
communautaire, gouvernance opaque, financée par dons, `429` dès la 8ᵉ requête
rapide **sans en-tête de quota**, et pas de genres sur les recommandations. Une
migration jetable qu'il aurait fallu refaire.

**Reste un repli crédible** : si AniList échoue en cours de route, une constante
d'URL rend le site fonctionnel.

## Limite assumée

Jikan ne joint pas les genres à une recommandation. Les classer exactement
coûterait six requêtes par modale, contre un budget d'une par seconde. Une
suggestion adulte proposée sous une œuvre qui ne l'est pas reste donc nette.

---

Références : [documentation Jikan](https://docs.api.jikan.moe/) ·
[jikan-rest](https://github.com/jikan-me/jikan-rest) ·
[WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)
