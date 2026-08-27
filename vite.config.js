import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Quelle source de données part dans le bundle.
 *
 * Le choix est résolu **ici**, à la compilation, et non dans le code : une
 * façade qui importerait les deux adaptateurs les embarquerait tous les deux —
 * mesuré à 1,6 ko gzip de plus au démarrage, pour du code que personne
 * n'exécute. L'alias fait entrer la source retenue, et elle seule.
 *
 * `VITE_SOURCE_DONNEES=jikan npm run build` bascule sur l'API historique.
 */
const SOURCES = { anilist: './src/services/anilist.js', jikan: './src/services/jikan.js' }
const sourceDemandee = process.env.VITE_SOURCE_DONNEES
const sourceDonnees = SOURCES[sourceDemandee] ?? SOURCES.anilist

/**
 * Où le site est servi, décidé par l'hôte qui construit.
 *
 * Vercel pose `VERCEL=1` dans l'environnement de build : la configuration s'y
 * adapte seule, sans réglage à tenir à jour de part et d'autre. Les deux
 * hébergements peuvent ainsi coexister le temps de la transition, chacun
 * construit correctement depuis le même dépôt.
 *
 * Trois choses en dépendent, et elles doivent bouger **ensemble** — un préfixe
 * juste avec un routeur qui l'ignore donne un site qui ne s'affiche pas :
 *   - `base` : le préfixe des ressources ;
 *   - le `basename` du routeur, lu depuis `import.meta.env.BASE_URL` ;
 *   - l'origine des adresses canoniques.
 *
 * L'origine de production est **fixe même en préversion** : une préversion qui
 * se déclarerait canonique se mettrait en concurrence avec le site réel dans
 * les moteurs de recherche.
 */
const surVercel = Boolean(process.env.VERCEL)
const domaineVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
const origineSite = surVercel && domaineVercel
  ? `https://${domaineVercel}`
  : 'https://lisow7.github.io'

/**
 * L'optimisation d'images n'existe que chez Vercel.
 *
 * AniList ne sert que du PNG — aucune variante WebP, aucune négociation de
 * contenu, vérifié. La transformation doit donc venir de l'hébergement, et
 * `/_vercel/image` n'existe que là. Ailleurs, les jaquettes sont servies telles
 * quelles, comme aujourd'hui.
 */
const optimiseLesImages = surVercel

/**
 * La page servie pour une adresse inconnue, selon l'hôte.
 *
 * GitHub Pages ne sait pas réécrire : son `404.html` porte un script qui
 * renvoie vers l'application en lui repassant le chemin demandé. C'est ce qui
 * fait tenir la navigation profonde — au prix d'un statut `404` sur toutes les
 * pages, y compris les vraies.
 *
 * Vercel réécrit les routes connues et n'a donc pas besoin de ce détour. Y
 * laisser le script serait pire qu'inutile : une adresse invalide partirait en
 * boucle vers l'application au lieu de dire franchement qu'elle n'existe pas.
 * Une adresse inconnue doit rendre un vrai `404` — c'est le pendant du gain,
 * sans quoi on remplacerait un défaut par son symétrique : toutes les URL
 * inventées passeraient pour des pages valides.
 */
const page404Vercel = {
  name: 'page-404-vercel',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    if (!surVercel) return
    delete bundle['404.html']
    this.emitFile({
      type: 'asset',
      fileName: '404.html',
      source: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>Page introuvable — Anime-Ink</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#0f1115;
         color:#e8eaed; font-family:system-ui,-apple-system,"Segoe UI",sans-serif; text-align:center; padding:1.5rem }
  h1 { font-size:1.5rem; margin:0 0 .5rem }
  p { color:#9aa0a6; margin:0 0 1.5rem }
  a { display:inline-block; padding:.6rem 1.25rem; border-radius:.5rem;
      background:#15803d; color:#fff; text-decoration:none; font-weight:600 }
</style>
</head>
<body>
  <main>
    <h1>Cette page n'existe pas</h1>
    <p>Le lien est peut-être incomplet, ou la page a été retirée.</p>
    <a href="/">Retour à l'accueil</a>
  </main>
</body>
</html>
`,
    })
  },
}

const inlineCssPlugin = {
  name: 'inline-css',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html
      const cssChunk = Object.values(ctx.bundle).find(f => f.type === 'asset' && f.fileName.endsWith('.css'))
      if (!cssChunk) return html
      return html.replace(
        /<link rel="stylesheet" crossorigin href="[^"]+\.css">/,
        `<style>${cssChunk.source}</style>`
      )
    },
  },
}

export default defineConfig({
  // GitHub Pages sert le site sous le nom du dépôt ; Vercel le sert à la racine.
  base: surVercel ? '/' : '/Anime-Ink/',
  plugins: [react(), tailwindcss(), inlineCssPlugin, page404Vercel],
  resolve: {
    alias: {
      'source-donnees': fileURLToPath(new URL(sourceDonnees, import.meta.url)),
    },
  },
  define: {
    // Le nom sert à l'attribution affichée en pied de page ; il doit suivre
    // l'alias, sinon le site citerait une source qu'il n'interroge pas.
    __SOURCE_DONNEES__: JSON.stringify(SOURCES[sourceDemandee] ? sourceDemandee : 'anilist'),
    __ORIGINE_SITE__: JSON.stringify(origineSite),
    __OPTIMISE_IMAGES__: JSON.stringify(optimiseLesImages),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-router'
        },
      },
    },
  },
})
