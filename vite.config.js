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
  base: '/Anime-Ink/',
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
