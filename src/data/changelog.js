export const CURRENT_VERSION = '1.1'

export const CHANGELOG = [
  {
    version: '1.1',
    date: '22 avril 2026',
    changes: [
      { type: 'fix',   label: 'Routing GitHub Pages — refresh sur toutes les pages fonctionnel' },
      { type: 'fix',   label: 'Lien "Voir tout" vers le catalogue corrigé' },
      { type: 'fix',   label: 'Mentions légales — hébergeur mis à jour (GitHub Pages)' },
      { type: 'fix',   label: 'URLs canoniques, SEO et sitemap mis à jour' },
      { type: 'ui',    label: 'Tooltip sur les titres tronqués au survol' },
      { type: 'ui',    label: 'Footer — version affichée et cliquable' },
    ],
  },
  {
    version: '1.0',
    date: '22 avril 2026',
    changes: [
      { type: 'deploy', label: 'Déploiement initial sur GitHub Pages' },
      { type: 'perf',   label: 'Lighthouse 99 / 100 / 100 / 100 (Performance, Accessibilité, Bonnes pratiques, SEO)' },
      { type: 'perf',   label: 'Code splitting — bundle initial réduit de 393KB à 43KB' },
      { type: 'perf',   label: 'CSS inliné — suppression du render-blocking (456ms → 0ms)' },
      { type: 'perf',   label: 'LCP optimisé — de 3.2s à 1.8s' },
      { type: 'perf',   label: 'Cache localStorage pour l\'animé aléatoire (TTL 1h)' },
      { type: 'feat',   label: 'Watchlist — fusion automatique des saisons d\'une même franchise' },
      { type: 'ui',     label: 'Contraste couleurs WCAG AA en mode clair et sombre' },
      { type: 'ui',     label: 'Aria-labels sur tous les filtres (accessibilité)' },
    ],
  },
]
