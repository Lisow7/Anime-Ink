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
  plugins: [react(), tailwindcss(), inlineCssPlugin],
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
