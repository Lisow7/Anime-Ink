# Changelog — Anime-Ink

Toutes les modifications notables sont documentées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)

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

---

## [1.0] — 22 avril 2026

### Déploiement
- Mise en production initiale sur GitHub Pages

### Performance
- Lighthouse 99 / 100 / 100 / 100 (Performance, Accessibilité, Bonnes pratiques, SEO)
- Code splitting React.lazy + Suspense — bundle initial réduit de 393KB à 43KB
- CSS inliné dans le HTML via plugin Vite — suppression du render-blocking (456ms → 0ms)
- LCP optimisé — fond flouté masqué sur mobile, LCP candidate = `<h1>` statique (3.2s → 1.8s)
- Cache localStorage stale-while-revalidate pour l'animé aléatoire (TTL 1h)
- Images switchées vers `image_url` — données image réduites de 664KB à 248KB

### Fonctionnalités
- Watchlist : fusion automatique des doublons de saisons pour une même franchise
- Filtre de contenu adulte (censure hentai / ecchi) avec badge d'âge
- Cache de l'animé aléatoire persistant entre les sessions

### Interface
- Contraste couleurs WCAG AA en modes clair et sombre (variables CSS adaptatives)
- Aria-labels sur tous les filtres et selects (accessibilité)
- Ordre des headings corrigé
- Footer : mention Version 1.0, statut API en temps réel
