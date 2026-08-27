# Feuille de route — Anime-Ink

> État au 27 août 2026. **v1.3 en production** : https://lisow7.github.io/Anime-Ink/
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

**« Servir la dernière réponse valide pendant une panne » — arbitrage, pas
tâche.** Le constat tient : `cache.js` supprime l'entrée dès son expiration, il
n'existe aucun mode « périmé plutôt que rien ». Mais le gain serait mince. Le
cache vit en `sessionStorage` : il meurt avec l'onglet. Servir du périmé
n'aiderait donc que dans une session ouverte depuis plus d'une heure — pas dans
le cas qui fait mal, l'arrivée sur un site dont l'API est tombée, où le cache est
vide de toute façon.

Le rendre utile supposerait `localStorage`, que le projet refuse délibérément :
ce quota de 5 Mo porte les favoris, la liste de suivi et l'historique, données
irremplaçables qu'un cache jetable n'a pas à mettre en péril. **C'est donc un
choix entre confort hors-ligne et protection des données de l'utilisateur**, à
poser comme tel le jour où on le reprendra — pas une ligne à cocher.

**Enfin, une nuance sur `Retry-After`** : sa prise en charge existe bien dans le
code, mais **Jikan n'envoie jamais cet en-tête** (mesuré sur un vrai `429`). Le
repli fait tout le travail. Ce chemin n'a donc jamais été éprouvé en conditions
réelles, et il ne faut pas le croire tel.

## Reste à faire

### Expérience

- [ ] progression par épisode et page « Où reprendre ? » — s'appuie sur la liste
      de suivi qui existe déjà, aucune infrastructure nouvelle ;
- [ ] calendrier des sorties ;
- [ ] import/export JSON des favoris et de la liste ;
- [ ] filtres par année, studio, saison, durée ;
- [ ] statistiques personnelles, sans traçage ;
- [ ] comparaison de plusieurs animés.

*(« Afficher la date de la dernière donnée valide en mode dégradé » a disparu de
cette liste : elle supposait qu'une donnée périmée soit servie, ce que la section
précédente écarte. Sans elle, il n'y a aucune date à montrer.)*

### Qualité

- [ ] valider les réponses de l'API contre des schémas versionnés.

Le **poids** des bundles est tenu (voir plus haut). Les métriques de terrain,
elles, ne relèvent pas de cette section : voir ci-dessous.

### Nécessite un autre hébergement

Ces points supposent un déplacement, pas un développement. Aucun n'est bloquant
aujourd'hui — les lire comme des manques urgents serait un contresens :

- [ ] **les quatre protections qui n'existent qu'en en-tête HTTP.** À ne pas lire
      comme « le site n'a pas de CSP » : il en a une, en balise
      `<meta http-equiv>` dans `index.html`, et elle couvre l'essentiel —
      `default-src`, `script-src`, `connect-src`, `img-src`, `frame-src`,
      `form-action`, `base-uri`, `object-src`, `upgrade-insecure-requests`.

      Quatre choses lui échappent, et aucune n'est exprimable dans une balise :
      `frame-ancestors` (empêcher qu'un tiers place le site dans une iframe),
      `report-uri` (recevoir les violations), `sandbox`, et `Permissions-Policy`,
      qui n'a aucune forme `<meta>`. Vérifié : la production ne sert que
      `Strict-Transport-Security`, et GitHub Pages n'offre aucun moyen de
      configurer les en-têtes — ni fichier `_headers`, ni `.htaccess`.

      **Portée réelle** : le seul manque à conséquence concrète est
      `frame-ancestors`. Sur un site sans compte, sans paiement ni action
      destructrice, il n'y a rien à détourner par clickjacking — c'est une
      protection de principe, pas un trou béant ;
- [ ] proxy de cache en périphérie, et métriques de disponibilité ;
- [ ] **métriques de terrain (LCP, CLS, INP)** — les mesurer chez le visiteur
      suppose de les recevoir quelque part. Le site n'a aucun back-end, et lui en
      donner un pour ce seul usage serait disproportionné. En attendant, la
      performance se surveille par le **poids** en intégration continue et par
      Lighthouse en laboratoire.

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
- [ ] le floutage des **suggestions de recherche** — seule surface encore non
      vérifiée. Elle exige que Jikan réponde à la requête exacte que la frappe
      compose, or seules les recherches déjà en cache sortent. Il n'y a pas de
      contournement : amorcer le cache demanderait que le scrape réussisse, ce
      qui est précisément ce qui échoue.

*(La ligne sur `filter=explicit_genres` a disparu d'ici : sa conclusion était
fausse. Voir « La nature de la panne » ci-dessus — le paramètre n'est pas cassé,
ses variantes ne sont simplement pas en cache.)*

## Limite assumée

Jikan ne joint pas les genres à une recommandation. Les classer exactement
coûterait six requêtes par modale, contre un budget d'une par seconde. Une
suggestion adulte proposée sous une œuvre qui ne l'est pas reste donc nette.

---

Références : [documentation Jikan](https://docs.api.jikan.moe/) ·
[jikan-rest](https://github.com/jikan-me/jikan-rest) ·
[WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)
