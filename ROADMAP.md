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
- Les deux sont **prouvés par mutation** : on a vérifié qu'ils échouent quand ils
  doivent échouer.
- 65 tests unitaires sur la couche réseau et les utilitaires.

### Performance

Lighthouse 100, LCP 1,7 s, CLS 0. Jaquettes en WebP, bundle découpé, `preconnect`
corrigés.

## Annoncé à tort comme livré — à faire, ou à retirer

- [ ] **Servir la dernière réponse valide pendant une panne.** L'ancienne liste
      l'annonçait ; le cache supprime au contraire l'entrée dès son expiration
      (`cache.js`). Seuls les genres et les traductions ont un filet. Un mode
      « périmé plutôt que rien » reste à écrire.
- [ ] **Détecter une erreur Jikan dans une réponse `200`.** Rien ne le fait : le
      client ne regarde que `response.ok`.

À noter : la prise en charge de `Retry-After` existe bien dans le code, mais
**Jikan n'envoie jamais cet en-tête** (mesuré sur un vrai `429`). Le repli fait
tout le travail.

## Reste à faire

### Expérience

- [ ] progression par épisode et page « Où reprendre ? » — s'appuie sur la liste
      de suivi qui existe déjà, aucune infrastructure nouvelle ;
- [ ] calendrier des sorties ;
- [ ] import/export JSON des favoris et de la liste ;
- [ ] filtres par année, studio, saison, durée ;
- [ ] statistiques personnelles, sans traçage ;
- [ ] comparaison de plusieurs animés ;
- [ ] afficher la date de la dernière donnée valide en mode dégradé.

### Qualité

- [ ] tests de parcours Playwright — le navigateur est déjà outillé pour
      l'accessibilité, il ne manque que les scénarios ;
- [ ] budgets Core Web Vitals et poids des bundles en intégration continue ;
- [ ] valider les réponses de l'API contre des schémas versionnés.

### Nécessite un autre hébergement

GitHub Pages ne sert pas d'en-têtes personnalisés. Ces deux points supposent un
déplacement, pas un développement :

- [ ] vrais en-têtes `Content-Security-Policy` et `Permissions-Policy` ;
- [ ] proxy de cache en périphérie, et métriques de disponibilité.

## Vérifications en attente

- [ ] confirmer les correctifs de censure **en production contre du vrai contenu
      adulte** : ils ont été prouvés localement et par tests, mais Jikan était en
      panne au moment de la mise en ligne, donc le catalogue ne chargeait rien ;
- [ ] retester `/genres/anime?filter=explicit_genres` : ses **quatre** valeurs
      répondaient `504` alors que le même endpoint sans paramètre fonctionnait —
      à savoir si le paramètre est cassé durablement.

## Limite assumée

Jikan ne joint pas les genres à une recommandation. Les classer exactement
coûterait six requêtes par modale, contre un budget d'une par seconde. Une
suggestion adulte proposée sous une œuvre qui ne l'est pas reste donc nette.

---

Références : [documentation Jikan](https://docs.api.jikan.moe/) ·
[jikan-rest](https://github.com/jikan-me/jikan-rest) ·
[WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)
