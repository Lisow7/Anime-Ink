# Changelog — Anime-Ink

Toutes les modifications notables sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

---

## [1.5] — en préparation

### Corrections
- Une panne de l’API ne vide plus un écran déjà consulté : la dernière réponse connue est resservie plutôt que rien, pendant vingt-quatre heures au plus. Jusqu’ici, la donnée était effacée à l’expiration — au moment précis où elle allait servir
- Et le pied de page dit de quand elles datent : « API indisponible · données du 27 août à 14:19 ». Resservir une copie sans le dire laisserait croire qu’elle est fraîche

### Maintenance
- Neuf parcours utilisateur au lieu de huit, et la nature de la panne Jikan documentée : elle se répartit par présence dans son cache, pas par endpoint

---

## [1.4] — 27 août 2026

### Corrections
- Tes favoris, tes animés récents et ta liste de suivi ne disparaissent plus quand l’API est en panne : ils vivent sur ton appareil et n’avaient aucune raison d’attendre une réponse. Ces trois onglets déclenchaient pourtant une requête à chaque visite, dont l’échec vidait l’écran

### Maintenance
- Huit parcours utilisateur vérifiés à chaque pull request, dans un vrai navigateur : recherche, filtres et leur persistance dans l’URL, favoris avec et sans consentement, mode dégradé, censure. Les tests existants ne couvraient que la couche réseau et les utilitaires — aucun ne regardait ce que les pages font
- Un budget de poids refuse les régressions de bundle : 100,7 ko au démarrage, 138,7 ko au total, plafonds serrés à 3 %. La performance gagnée en v1.2 ne pouvait jusqu’ici être reperdue sans que rien ne le signale
- La règle de numérotation des versions est écrite dans le README : quelle version porte un commit, quand la version affichée bouge, et l’avertissement qu’avant la 1.2 la convention était l’inverse
- Feuille de route rapatriée dans le dépôt et relue dans le code : deux points s’y annonçaient livrés sans l’être, et les instruire a suffi à les régler — l’un était sans objet, l’autre est un arbitrage et non une tâche

---

## [1.3] — 26 août 2026

### Corrections
- La liste de suivi respecte la censure : ses jaquettes s’affichaient en clair alors que l’onglet « Favoris », juste à côté, les floutait
- Les suggestions « Vous aimerez aussi » suivent la censure : personne ne les a choisies, et elles s’affichaient en clair sous une œuvre pour public averti
- La fiche d’un animé pour public averti annonce son contenu avant de le montrer : ouverte depuis un lien partagé, elle affichait sa jaquette sans que rien n’ait prévenu. Un bouton « Afficher quand même » la révèle, et permet de la remasquer ; le titre et le synopsis restent lisibles

### Maintenance
- Un test vérifie que toute surface affichant une jaquette classe son contenu adulte, ou figure parmi des exemptions justifiées — c’est lui qui a signalé la liste de suivi
- Le garde-fou d’accessibilité visite désormais les états d’échec et l’avertissement de contenu : 30 scénarios au lieu de 24. Ces écrans n’existent que lorsque l’API tombe, et échappaient donc entièrement à l’analyse

---

## [1.2] — 25 août 2026

### Corrections
- Une panne de l’API n’affiche plus « animé introuvable » : le message distingue une fiche inexistante d’un service momentanément indisponible, et propose de réessayer
- Le voyant d’état de l’API restait rouge en permanence — il interrogeait une adresse qui n’est pas un point d’entrée ; il dérive désormais des appels réels, sans requête supplémentaire
- La censure couvre enfin le genre « Erotica » : 95 animés s’affichaient en clair alors qu’elle était active, seuls « Hentai » et « Ecchi » étant reconnus
- Le filtre par genre ne propose plus les genres explicites quand la censure est active, et un filtre de ce type déjà posé est levé quand on la réactive
- Les suggestions de la recherche respectent la censure : leur vignette était servie en clair alors que la même jaquette était floutée dans la grille, et elles indiquent désormais le palier d’âge
- La recherche de l’accueil n’annonce plus « aucun animé trouvé » quand l’API est en panne : une recherche sans résultat et un service indisponible ont désormais deux messages distincts
- L’« animé surprise » ne se réduit plus à son titre lorsque son chargement échoue : la section explique la panne et propose de réessayer
- La liste de suivi ne s’interrompt plus au premier animé dont la franchise échoue
- Les erreurs de l’API ne sont plus renvoyées aux composants comme si c’étaient des données

### Performance
- Jaquettes servies en WebP : environ 40 % de poids en moins, à dimensions identiques
- Première visite du catalogue : 24,8 ko de JavaScript au lieu de 45,6 (−45 %)
- Chunk `Catalogue` : 23,4 → 6,3 ko gzip, `@dnd-kit` n’étant plus chargé que pour l’onglet « Ma liste »
- `AnimeModal` chargé à la demande et amorcé au repos, au lieu d’être monté sur toutes les routes
- Cache applicatif des réponses : revenir sur une page déjà consultée ne déclenche plus de requête
- Débit des requêtes calé sur le seau à jetons réel de Jikan (rafale de 3, une par seconde), au lieu de 171 par minute pour 60 autorisées
- Indices `preconnect` corrigés : leur mode d’identifiants ne correspondait pas à celui des requêtes, et Lighthouse les rapportait tous inutilisés

### Accessibilité
- Recherche conforme au modèle ARIA combobox : flèches, Entrée, Échap, et annonce des suggestions
- La liste de suivi se réordonne au clavier — la poignée se présentait comme déplaçable mais ne répondait à aucune touche, et sa consigne était en anglais
- Lien « Aller au contenu » pour sauter la barre de navigation
- Les trois interrupteurs de consentement aux cookies ont un nom accessible
- Contrastes conformes WCAG AA dans les deux thèmes : couleurs de note, palette du changelog, liens des mentions légales, filtres, bordures de champs
- Les liens des mentions légales sont soulignés, la couleur seule ne les distinguant pas
- Cibles tactiles portées à 24 px minimum (favoris, filtre alphabétique)
- Les cartes n’imbriquent plus de contrôles interactifs les uns dans les autres
- États annoncés : `aria-current` sur la navigation, `aria-pressed` sur les bascules, `role="alert"` sur les erreurs
- Hiérarchie des titres corrigée sur l’accueil, titre unique dans la modale, `scope` sur les en-têtes de tableau

### Maintenance
- Garde-fou d’accessibilité : axe-core sur 24 scénarios (5 routes, 2 thèmes, bureau et mobile, modales ouvertes), exécuté à chaque pull request
- La CI de qualité s’exécute aussi sur les pull requests vers `dev`, qu’elle ignorait jusqu’ici
- Couche réseau isolée en modules testés : 51 tests unitaires
- Dépendances et actions de CI à jour, ESLint passé en version 10 — vérifié par mutation, il inspecte bien les 59 fichiers
- Dependabot vise désormais `dev` : ses propositions arrivaient sur `main` et court-circuitaient la branche d’intégration

---

## [1.1] — 22 avril 2026

### Corrections
- Routing GitHub Pages : refresh sur n'importe quelle page ne provoque plus de 404
- Lien "Voir tout" vers le catalogue corrigé (`<a href>` → `<Link to>`)
- Mentions légales : hébergeur mis à jour (GitHub Pages, Inc.)
- URLs canoniques, balises SEO, og:image et sitemap corrigés (→ lisow7.github.io/Anime-Ink)

### Interface
- Tooltip sur les titres tronqués : nom complet visible au survol
- Footer : bouton version cliquable ouvrant les notes de version (changelog)

### Maintenance
- `.gitignore` : rapports Lighthouse exclus du dépôt

---

## [1.0] — 22 avril 2026

### Déploiement
- Mise en production initiale sur GitHub Pages
- Workflow GitHub Actions automatique sur push vers `main`

### Performance
- Lighthouse 99 / 100 / 100 / 100 (Performance, Accessibilité, Bonnes pratiques, SEO)
- Code splitting React.lazy + Suspense — bundle initial réduit de 393KB à 43KB
- CSS inliné dans le HTML via plugin Vite — suppression du render-blocking (456ms → 0ms)
- LCP optimisé — fond flouté masqué sur mobile, LCP candidate = `<h1>` statique (3.2s → 1.8s)
- Cache localStorage stale-while-revalidate pour l'animé aléatoire (TTL 1h)
- Images switchées vers `image_url` — données image réduites de 664KB à 248KB
- Chunks Vite séparés : `vendor-react` et `vendor-router`

### Fonctionnalités
- Watchlist : fusion automatique des doublons de saisons pour une même franchise
- `getEntry`, `getStatus`, `setStatus`, `remove` rendus franchise-aware dans WatchlistContext

### Interface
- Contraste couleurs WCAG AA en modes clair et sombre (variables CSS `--color-accent`, `--badge-airing-*`)
- Aria-labels sur tous les filtres et selects
- Ordre des headings corrigé (`<h3>` → `<h2>` / `<p>` selon contexte)
- Footer : mention Version 1.0, statut API en temps réel

---

## [0.6] — 20 avril 2026

### Fonctionnalités
- SEO complet : balises meta, Open Graph, Twitter Card, données structurées JSON-LD
- Hook `useSEO` pour la gestion dynamique des métadonnées par page
- Gestion des cookies RGPD : bannière de consentement, modale de préférences granulaires
- `CookieContext` : trois catégories (essentiel, préférences, données personnelles)
- Recherche par acronymes : "SnK" → Shingeki no Kyojin, "MHA" → My Hero Academia, etc.
- Page Mentions légales complète (RGPD, hébergement, propriété intellectuelle)
- Manifest PWA (`manifest.json`), `robots.txt`, `sitemap.xml`, `og-image.svg`

### Interface
- Navbar : refonte complète avec menu mobile, recherche intégrée, toggle thème, bouton censure
- Améliorations UI générales sur l'ensemble du site

---

## [0.5] — 20 avril 2026

### Interface
- Refonte complète du responsive sur toutes les pages
- Approche mobile-first appliquée systématiquement
- Grille adaptative de 2 à 6 colonnes selon la taille d'écran
- Ajustements typographiques, espacements et composants pour mobile, tablette et desktop

---

## [0.4] — 19 avril 2026

### Fonctionnalités
- Watchlist tracker : tableau de suivi avec statuts (À voir, En cours, Terminé, Abandonné)
- Suivi par épisode et par saison, données de franchise regroupées
- Filtre de contenu adulte : censure automatique des genres hentai et ecchi (flou + badge d'âge)
- Couleurs dynamiques sur les scores selon la note (vert, jaune, rouge)
- Réorganisation et amélioration de l'UI du catalogue

---

## [0.3] — 19 avril 2026

### Fonctionnalités
- Page Profil : historique de consultation, statistiques personnelles, gestion des favoris
- Animé aléatoire sur la page d'accueil avec bouton de rafraîchissement
- Watchlist initiale avec tableau filtrable (statuts, types, tri)
- `HistoryContext` : suivi automatique des animés consultés

---

## [0.2] — 19 avril 2026

### Fonctionnalités
- Thème clair / sombre avec détection automatique de la préférence système (`ThemeContext`)
- Animés similaires (recommandations) sur la page détail
- Footer avec statut API en temps réel et liens utiles
- Bouton scroll-to-top
- Section "Top animés du moment" sur la page d'accueil
- Loupe de recherche dans la Navbar

### Interface
- Score coloré sur les cartes animé
- Badge "Vu" sur les animés déjà consultés
- Cœur favori repositionné en haut à droite des cartes
- Optimisations React : `React.memo`, centralisation CSS et constantes
- Gestion des erreurs API avec messages utilisateur

---

## [0.1] — 18 avril 2026

### Fonctionnalités
- Catalogue avec pagination, filtres (genre, statut, ordre) synchronisés via URL params
- Page détail d'un animé : synopsis, informations, genres, score, trailer YouTube
- Favoris persistants en localStorage (`FavoritesContext`)
- Modale animé : ouverture rapide depuis n'importe quelle page (`ModalContext`)
- Correction du positionnement du cœur favori dans le catalogue

---

## [0.0] — 18 avril 2026

### Initialisation du projet
- Création du projet avec Vite + React 19 + Tailwind CSS v4 + React Router v7
- Structure de base : `src/pages/`, `src/components/`, `src/services/`, `src/context/`
- Couche API Jikan v4 : `searchAnime`, `getAnimeById`, `getTopAnime`, `getAnimeByFilter`, `getGenres`
- Page d'accueil avec barre de recherche et suggestions en temps réel
- `AnimeCard` : carte animé avec image, titre, score, statut, épisodes
- Premier commit
