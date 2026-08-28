# Changelog — Anime-Ink

Toutes les modifications notables sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

---

## [1.12] — 28 août 2026

### Nouveautés
- **« Tes goûts » sur ton profil** : les genres et les époques que tes choix dessinent, en barres proportionnelles. Le profil comptait déjà — combien de favoris, combien d’heures — mais ne racontait rien
- **Aucune requête, aucun envoi** : tout se calcule dans ton navigateur à partir de ce qui y est déjà enregistré
- Seuls tes favoris et ta liste comptent. L’historique dit ce que tu as *ouvert*, souvent par curiosité : le compter prendrait un coup d’œil pour un goût

### Maintenance
- Le plafond de poids total passe de 146 à 148 ko. Les deux plafonds ne font pas le même travail, et c’est maintenant écrit : celui du **démarrage** reste strict — il mesure ce que chaque visiteur télécharge, et n’a aucune raison de croître — tandis que le **total** monte légitimement à chaque écran ajouté

---

## [1.11] — 28 août 2026

### Corrections
- **Survoler une carte ne t’emmène plus hors du site.** La vignette laissait place à une bande-annonce, et un clic partait sur YouTube — personne ne demande à quitter un catalogue en promenant sa souris. La bande-annonce reste là où on la cherche : sur la fiche de l’animé
- **La grille des mieux notés ne laisse plus de case vide.** Les entrées d’une même franchise sont réunies en une carte ; comme le découpage à six se faisait *avant* ce regroupement, il n’en restait parfois que cinq dans une grille taillée pour six
- **L’onglet « Ma liste » est visible même quand elle est vide.** Il n’apparaissait qu’une fois la liste remplie : suivre une série était donc impossible à découvrir pour qui ne connaissait pas déjà la fonction. L’écran vide explique maintenant comment ajouter

---

## [1.10] — 28 août 2026

### Nouveautés
- **Filtre le catalogue par saison et par année.** « L’été 2026 », « l’automne 2019 » — c’est ainsi qu’on parle des animés, et c’est maintenant ainsi qu’on peut les chercher. Les deux filtres entrent dans l’adresse : un lien vers une saison se partage et se met en signet
- L’année à venir figure au menu : les saisons s’annoncent avant de sortir

### Maintenance
- **Une veille hebdomadaire confronte la source de données à ce que le site attend.** Les jeux de test étant figés, rien n’aurait signalé qu’AniList change un champ : les tests seraient passés pendant que l’écran se vidait. Le contrôle interroge la vraie API, hors de la CI pour ne pas faire dépendre les fusions d’un service extérieur, et ouvre une issue en cas de rupture
- Rien de visible : la version affichée reste `1.9`

---

## [1.9] — 28 août 2026

### Nouveautés
- **« Cette semaine » sur ton profil** : les sorties à venir de tes séries, groupées par jour et par heure. Elle couvre tes favoris **et** ta liste de suivi — on peut mettre en favori sans suivre
- La vue s’arrête à ce que tu suis, et c’est délibéré : la source annonce **5 000 diffusions sur sept jours**. Un calendrier du catalogue entier serait illisible

> ⚠️ Une série diffusée **deux fois** dans la même semaine n’apparaît qu’une fois : la source ne donne que le prochain épisode de chaque titre.

---

## [1.8] — 28 août 2026

### Nouveautés
- **Tes données peuvent enfin sortir du navigateur.** Un bouton sur ton profil télécharge tes favoris, ta liste de suivi et ton historique dans un fichier. Un autre les restaure — sur un autre appareil, ou après un nettoyage de navigateur. Jusqu’ici, un « effacer les données du site » les emportait sans recours
- **Une restauration complète, elle ne remplace jamais.** Importer une vieille sauvegarde ne peut pas faire reculer une progression : une série suivie jusqu’à l’épisode 12 le reste, même si le fichier la connaît à l’épisode 3
- Le fichier n’emporte **pas** ton consentement aux cookies : le restaurer reviendrait à te faire dire oui à ta place. Il te sera redemandé, comme à la première visite
- Un fichier abîmé ou venu d’ailleurs est refusé **en entier**, sans rien écrire : une restauration à moitié laisserait un état dont personne ne saurait d’où il vient

### Maintenance
- **L'ancienne source de données est retirée du code.** Elle n'était plus interrogée depuis la v1.6 et ferme le 1ᵉʳ octobre : la garder câblée revenait à maintenir et tester un chemin vers un service éteint. Rien ne change à l'écran
- Le socle réseau qu'elle avait apporté — cache, limiteur, secours pendant une panne — reste en place et sert la source actuelle
- Les commentaires qui décrivaient un état révolu sont corrigés : l'un annonçait encore au futur une amélioration déjà livrée, deux messages d'erreur nommaient encore l'API disparue
- Le socle réseau porte enfin son nom : il ne contenait rien de propre à l'ancienne source, et sert la nouvelle sans avoir été réécrit
- La porte d'entrée des données n'expose plus que ce dont les écrans se servent — **et un garde-fou refuse désormais tout export sans appelant**, pour que la dérive ne revienne pas à la prochaine suppression
- Le réglage du limiteur est confronté au plafond réel de l'API : le dépasser ne dégraderait pas le service, il le ferait refuser

> Rien de visible dans ce lot : la version affichée reste `1.7`.

---

## [1.7] — 27 août 2026

### Nouveautés
- **Une section « Reprendre » sur ton profil.** Tes séries déclarées en cours, l’épisode où tu t’es arrêté, et la date du prochain épisode quand elle est connue — « épisode 9 dans 3 jours, le 30 août ». Une série terminée garde sa progression, sans date inventée
- Toute la liste tient en **une seule requête**, quel qu’en soit le nombre de titres

### Maintenance
- Le plafond de poids passe de 104 à 105 ko, et pas davantage : à 107, la régression que ce garde-fou existe pour attraper — une page entière revenue dans le fichier de démarrage — repassait sans un mot
- Onze parcours et trente-deux passes d’accessibilité, dont la nouvelle section en thème clair et sombre

---

## [1.6] — 27 août 2026

### Nouveautés
- **Le site lit désormais AniList.** L’API Jikan, qui servait les données jusqu’ici, ferme le 1ᵉʳ octobre 2026 — annoncé par son équipe. Rien ne change dans l’usage : mêmes écrans, mêmes favoris, même liste de suivi
- Les saisons d’une série sont lues dans les liens que le catalogue déclare, au lieu d’être devinées en comparant les titres. Les franchises dont les titres ne se ressemblent pas cessent d’être manquées
- Chaque suggestion « Vous aimerez aussi » est jugée sur ses propres genres pour la censure. Jusqu’ici elles héritaient du registre de la fiche ouverte, faute que l’ancienne source les fournisse

### Corrections
- L’adresse canonique des pages ne double plus le nom du site. Toutes les pages sauf les fiches annonçaient aux moteurs de recherche une adresse qui n’existe pas — un défaut invisible à l’écran, présent depuis des mois
- La popularité d’une fiche affiche de nouveau un rang. Le nouveau catalogue compte des membres là où le précédent donnait une place : la fiche annonçait « POPULARITÉ #464889 »
- Une fiche que le catalogue ne connaît pas s’explique au lieu d’ouvrir une fenêtre vide
- Un lien périmé n’allume plus le voyant « API indisponible » : une fiche introuvable n’est pas une panne

### Performance
- Une fiche télécharge **137 ko de jaquette au lieu de 478**. Elle chargeait une image de 460 pixels dans un cadre de 192 — un choix de taille hérité de la bascule, invisible au budget de poids qui ne mesure que les fichiers du site. L’aperçu partagé sur les réseaux garde la grande version, où le poids ne coûte rien

### Ce qui change à l’écran
- **Le menu des genres propose 19 entrées au lieu de 78.** AniList classe plus largement ; les genres sans équivalent disparaissent du menu. Un lien mis en signet vers l’un d’eux affiche le catalogue complet, le filtre revenant à « tous »
- Le pied de page et les mentions légales citent AniList

### Maintenance
- La source est interchangeable : `VITE_SOURCE_DONNEES=jikan` rebascule sur l’API historique, qui reste câblée et testée. Le choix est résolu à la compilation, si bien qu’une seule des deux part dans le bundle
- Les dix parcours utilisateur et les trente passes d’accessibilité sont verts **sur les deux sources** — un écart accuserait le contrat commun
- Un dixième parcours part d’un poste déjà habité : des favoris écrits avant la bascule doivent y survivre, y compris ceux que la nouvelle source ignore. Tous les autres démarrent d’un navigateur vierge et n’auraient rien vu
- Le démarrage passe de 105,6 à 103,1 ko : le nouvel adaptateur pèse moins que l’ancien
- **Mesuré depuis** : AniList sert des jaquettes en PNG là où la source précédente servait du WebP — 140 ko contre 13 ko pour la même image. La fiche a été allégée de 478 à 137 ko en cessant de charger du 460 pixels dans un cadre de 192 ; le reste suppose de convertir les images, ce que l'hébergement actuel ne permet pas (consigné dans `ROADMAP.md`)

---

## [1.5] — 27 août 2026

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
