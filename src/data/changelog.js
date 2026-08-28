export const CURRENT_VERSION = '1.13'

export const CHANGELOG = [
  {
    version: '1.13',
    date: '28 août 2026',
    changes: [
      { type: 'feat', label: 'Filtre le catalogue par durée : format court, épisode classique ou film' },
    ],
  },
  {
    version: '1.12',
    date: '28 août 2026',
    changes: [
      { type: 'feat', label: '« Tes goûts » sur ton profil : les genres et les époques que tes choix dessinent' },
    ],
  },
  {
    version: '1.11',
    date: '28 août 2026',
    changes: [
      { type: 'fix', label: 'Survoler une carte ne propose plus de partir sur YouTube — la bande-annonce reste sur la fiche' },
      { type: 'fix', label: 'La grille des mieux notés ne laisse plus de case vide' },
      { type: 'fix', label: 'L’onglet « Ma liste » est visible même avant d’avoir suivi une série' },
    ],
  },
  {
    version: '1.10',
    date: '28 août 2026',
    changes: [
      { type: 'feat', label: 'Filtre le catalogue par saison et par année — « l’été 2026 », par exemple' },
    ],
  },
  {
    version: '1.9',
    date: '28 août 2026',
    changes: [
      { type: 'feat', label: 'Une vue « Cette semaine » sur ton profil : les sorties à venir de tes séries, groupées par jour' },
    ],
  },
  {
    version: '1.8',
    date: '28 août 2026',
    changes: [
      { type: 'feat', label: 'Télécharge tes favoris, ta liste et ton historique dans un fichier — et restaure-les sur un autre appareil' },
      { type: 'ui', label: 'Une restauration complète tes données sans jamais écraser ce qui est déjà là' },
    ],
  },
  {
    version: '1.7',
    date: '27 août 2026',
    changes: [
      { type: 'feat', label: 'Une section « Reprendre » sur ton profil : tes séries en cours, l’épisode où tu t’es arrêté, et quand sort le suivant' },
    ],
  },
  {
    version: '1.6',
    date: '27 août 2026',
    changes: [
      { type: 'feat', label: 'Les données du site viennent désormais d’AniList — l’API précédente ferme le 1ᵉʳ octobre 2026' },
      { type: 'ui',  label: 'Les saisons d’une série sont lues dans les liens déclarés par le catalogue, non plus devinées d’après les titres' },
      { type: 'ui',  label: 'Le menu des genres propose 19 entrées au lieu de 78 — celles que le nouveau catalogue reconnaît' },
      { type: 'feat', label: 'Chaque suggestion « Vous aimerez aussi » est jugée sur ses propres genres pour la censure' },
      { type: 'fix', label: 'La popularité d’une fiche affiche de nouveau un rang, et non un nombre de membres' },
      { type: 'fix', label: 'L’adresse canonique des pages ne double plus le nom du site' },
      { type: 'perf', label: 'Une fiche télécharge 137 ko de jaquette au lieu de 478 — elle chargeait une image 2,4 fois plus grande que son affichage' },
    ],
  },
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
