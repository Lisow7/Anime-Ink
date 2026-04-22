# Anime-Ink

Application web de découverte et de suivi d'animés, construite avec React 19 et l'API publique Jikan v4 (MyAnimeList).

🌐 **Site en ligne :** [lisow7.github.io/Anime-Ink](https://lisow7.github.io/Anime-Ink/)

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
| Jikan API v4 | Données animés (wrapper non officiel MyAnimeList) |
| GitHub Pages | Hébergement statique |
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
│   └── jikan.js          # Couche d'appel à l'API Jikan
├── styles/               # Variables CSS, animations, composants
├── utils/                # Fonctions utilitaires (score, groupAnime…)
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
```

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

- [ ] Mettre à jour la version dans `src/components/Footer.jsx`
- [ ] Ajouter l'entrée dans `src/data/changelog.js`
- [ ] Mettre à jour `CHANGELOG.md`

---

## Versioning

| Version | Type |
|---|---|
| `1.x` | Petites mises à jour, corrections, améliorations |
| `2.0` | Grosse mise à jour — nouvelle feature majeure |

Voir [CHANGELOG.md](./CHANGELOG.md) pour l'historique complet.

---

## Licence

Projet personnel à but non commercial. Les données proviennent de l'API Jikan (non officielle) — © MyAnimeList.
