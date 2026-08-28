# Anime-Ink

Application web de découverte et de suivi d'animés, construite avec React 19 et l'API publique Jikan v4 (MyAnimeList).

🌐 **Site en ligne :** [anime-ink-blond.vercel.app](https://anime-ink-blond.vercel.app/)

---

## Fonctionnalités

- **Recherche** en temps réel avec suggestions et support des acronymes (SnK, MHA, AOT…)
- **Catalogue** avec filtres avancés (genre, type, statut, tri) synchronisés via URL
- **Page détail** : synopsis, score, genres, trailer YouTube, animés similaires
- **Favoris** persistants en localStorage
- **Watchlist** : suivi par épisode et par saison, fusion automatique des franchises
- **Historique** de consultation avec statistiques sur la page Profil
- **Filtre de contenu adulte** : censure automatique (hentai / ecchi) avec badge d'âge
- **Thème clair / sombre** avec détection automatique de la préférence système
- **SEO** : balises meta, Open Graph, Twitter Card, données structurées JSON-LD
- **RGPD** : gestion granulaire des cookies (bannière + modale de préférences)
- **Changelog** : notes de version accessibles depuis le footer

---

## Stack technique

| Technologie | Rôle |
|---|---|
| React 19 | UI — composants et état |
| React Router v7 | Routage SPA |
| Vite | Bundler + serveur de développement |
| Tailwind CSS v4 | Styles utilitaires |
| AniList (GraphQL) | Données animés — `VITE_SOURCE_DONNEES=jikan` rebascule sur l'API historique |
| Vercel | Hébergement — réécrit les routes en `200`, convertit les jaquettes en WebP, sert les en-têtes de sécurité |
| GitHub Actions | CI/CD — déploiement automatique |

---

## Architecture

```
src/
├── main.jsx              # Point d'entrée React
├── App.jsx               # Routeur principal + providers
├── index.css             # Thème global Tailwind
├── components/           # Composants réutilisables
├── context/              # Contextes React (favoris, watchlist, thème, cookies…)
├── data/                 # Données statiques (changelog)
├── hooks/                # Hooks personnalisés (useSEO, useDebounce)
├── pages/                # Pages (Home, Catalogue, AnimeDetail, Profil…)
├── services/
│   └── jikan/            # Seau à jetons, cache, TTL, client (testés séparément)
│   └── jikan.js          # Couche d'appel à l'API Jikan
├── styles/               # Variables CSS, animations, composants
├── utils/                # Fonctions utilitaires (score, groupAnime, posterUrl…)
└── constants/            # Constantes (genres, status, acronymes)
```

### Routes

| Route | Page | Description |
|---|---|---|
| `/` | Home | Accueil, recherche, animé aléatoire, top animés |
| `/catalogue` | Catalogue | Parcourir et filtrer avec pagination |
| `/anime/:id` | AnimeDetail | Fiche complète d'un animé |
| `/profil` | Profil | Historique, statistiques, gestion des données |
| `/mentions-legales` | MentionsLegales | Mentions légales et politique de confidentialité |

---

## Installation et développement

```bash
# Installer les dépendances
npm install

# Serveur de développement (http://localhost:5173)
npm run dev

# Build de production
npm run build

# Prévisualiser le build
npm run preview

# Linting
npm run lint

# Tests unitaires
npm run test

# Lint + tests + build
npm run check

# Garde-fou d'accessibilité (axe-core dans un vrai navigateur)
# Nécessite une première fois : npx playwright install chromium
npm run a11y
```

> `a11y` est volontairement absent de `check` : sur un dépôt fraîchement cloné,
> l'absence de Chromium ferait échouer la commande d'entrée sur une erreur qui
> se lit comme un dépôt cassé plutôt que comme une étape d'installation
> manquante. La CI, elle, l'exécute à chaque pull request.

---

## Process de contribution

### Branches

```
main        → production (GitHub Pages)
dev         → intégration
fix/nom     → correction ciblée
feat/nom    → nouvelle fonctionnalité
```

### Workflow par feature

1. Créer une branche depuis `dev` : `git checkout -b feat/nom` ou `fix/nom`
2. Développer et committer : `type(vX.X): titre court`
3. Pusher la branche : `git push origin feat/nom`
4. Ouvrir une Pull Request `feat/nom` → `dev` sur GitHub
5. Merger la PR sur GitHub
6. Ouvrir une Pull Request `dev` → `main`
7. Merger → déclenche le déploiement automatique

### Convention de commit

```
type(vX.X): titre court et pertinent
```

Types : `feat`, `fix`, `perf`, `ui`, `docs`, `ci`, `refactor`

### Avant chaque déploiement

- [ ] Mettre à jour `CURRENT_VERSION` dans `src/data/changelog.js` (le footer la lit de là, il n'y a rien à changer dans `Footer.jsx`)
- [ ] Ajouter l'entrée dans `src/data/changelog.js`
- [ ] Mettre à jour `CHANGELOG.md`

---

## Versioning

| Version | Type |
|---|---|
| `1.x` | Petites mises à jour, corrections, améliorations |
| `2.0` | Grosse mise à jour — nouvelle feature majeure |

### Quelle version porte un commit

**Celle dans laquelle le changement sortira**, c'est-à-dire la version en
préparation — pas celle qui tourne en production. Un commit poussé au lendemain
de la mise en ligne de la `1.3` porte donc `v1.4`.

Concrètement, après chaque mise en production :

1. le premier lot ouvre une entrée `## [X.Y] — en préparation` dans
   `CHANGELOG.md`, et les commits portent `type(vX.Y): titre` ;
2. `CURRENT_VERSION` (`src/data/changelog.js`), affiché en pied de page, **ne
   bouge que si le lot contient quelque chose de constatable par un visiteur**.
   Un lot de maintenance, de tests ou de documentation n'entraîne pas de bump :
   la version affichée reste celle de la production, puisque c'est elle que le
   visiteur utilise ;
3. à la mise en production, un commit `chore(vX.Y): release X.Y` remplace
   « en préparation » par la date, et la PR `dev → main` suit.

> **Attention en lisant `git log`** : jusqu'à la `1.2`, les commits portaient la
> version **courante** et non celle en préparation — les correctifs qui composent
> la `1.2` sont étiquetés `v1.1`. La convention ci-dessus s'applique depuis. Si
> l'ancienne vous convient mieux, c'est cette section qu'il faut changer, pas les
> commits.

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique complet, et
[ROADMAP.md](./ROADMAP.md) pour ce qui est livré, ce qui reste et ce qui
demanderait un autre hébergement.

---

## Licence

Projet personnel à but non commercial. Les données proviennent de l'API Jikan (non officielle) — © MyAnimeList.
