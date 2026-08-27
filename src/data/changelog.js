export const CURRENT_VERSION = '1.5'

export const CHANGELOG = [
  {
    version: '1.5',
    date: '27 août 2026',
    changes: [
      { type: 'fix', label: 'Une panne de l’API ne vide plus un écran déjà consulté — la dernière version connue est resservie' },
      { type: 'ui',  label: 'Le pied de page indique de quand datent les données resservies pendant une panne' },
    ],
  },
  {
    version: '1.4',
    date: '27 août 2026',
    changes: [
      { type: 'fix', label: 'Tes favoris, tes récents et ta liste ne disparaissent plus quand l’API est en panne — ils vivent sur ton appareil' },
    ],
  },
  {
    version: '1.3',
    date: '26 août 2026',
    changes: [
      { type: 'fix', label: 'La liste de suivi respecte la censure — ses jaquettes s’affichaient en clair' },
      { type: 'ui',  label: 'Une fiche pour public averti ouverte depuis un lien partagé prévient avant d’afficher sa jaquette' },
      { type: 'fix', label: 'Les suggestions « Vous aimerez aussi » suivent la censure' },
    ],
  },
  {
    version: '1.2',
    date: '25 août 2026',
    changes: [
      { type: 'fix',    label: 'Une panne de l’API n’annonce plus « animé introuvable » — le message distingue une fiche inexistante d’un service momentanément indisponible, avec un bouton pour réessayer' },
      { type: 'fix',    label: 'Le voyant d’état de l’API restait rouge en permanence : il reflète désormais les appels réels' },
      { type: 'fix',    label: 'La censure couvre enfin « Erotica » — 95 animés passaient à travers alors qu’elle était active' },
      { type: 'ui',     label: 'Le filtre par genre masque les genres explicites tant que la censure est active' },
      { type: 'fix',    label: 'Les suggestions de la recherche respectent la censure — leur vignette s’affichait en clair' },
      { type: 'fix',    label: 'La recherche de l’accueil ne dit plus « aucun animé trouvé » quand c’est l’API qui est en panne' },
      { type: 'fix',    label: 'L’« animé surprise » explique la panne et propose de réessayer, au lieu de laisser un titre seul' },
      { type: 'fix',    label: 'La liste de suivi ne s’arrête plus de charger au premier animé en échec' },
      { type: 'perf',   label: 'Jaquettes servies en WebP — environ 40 % de poids en moins, à définition identique' },
      { type: 'perf',   label: 'Première visite du catalogue : 45 % de JavaScript en moins' },
      { type: 'perf',   label: 'Les réponses de l’API sont mémorisées — revenir sur l’accueil ne recharge plus rien' },
      { type: 'perf',   label: 'Le rythme des requêtes suit la limite de l’API : plus de blocages en cascade' },
      { type: 'ui',     label: 'Recherche navigable au clavier (flèches, Entrée, Échap) et annoncée aux lecteurs d’écran' },
      { type: 'ui',     label: 'La liste de suivi se réordonne au clavier, en français' },
      { type: 'ui',     label: 'Lien « Aller au contenu » pour sauter la navigation' },
      { type: 'ui',     label: 'Contrastes conformes WCAG AA dans les deux thèmes — notes, changelog, mentions légales et filtres compris' },
      { type: 'ui',     label: 'Cibles tactiles agrandies (favoris, filtre alphabétique)' },
      { type: 'ui',     label: 'Les interrupteurs de consentement aux cookies annoncent enfin ce qu’ils gouvernent' },
      { type: 'chore',  label: 'Garde-fou d’accessibilité automatisé : 24 scénarios vérifiés à chaque pull request' },
    ],
  },
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
      { type: 'chore', label: '.gitignore — rapports Lighthouse exclus du dépôt' },
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
