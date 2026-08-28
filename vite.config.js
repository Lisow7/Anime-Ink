import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
// Hors Vercel, l'adresse du site reste celle du site : depuis le déplacement du
// 28 août 2026, l'ancien hébergement ne fait plus que rediriger, et annoncer
// ses adresses comme canoniques désignerait une page qui renvoie ailleurs.
const origineSite = surVercel && domaineVercel
  ? `https://${domaineVercel}`
  : 'https://anime-ink-blond.vercel.app'

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

/**
 * Sur Vercel, la page servie ne porte ni script inline ni politique en `<meta>`.
 *
 * ## Pourquoi retirer le script
 *
 * `script-src` acceptait `'unsafe-inline'`, ce qui revient à autoriser
 * n'importe quel script injecté dans la page — la protection principale de la
 * politique, annulée. Un seul élément l'exigeait : le décodeur d'adresses de
 * GitHub Pages, vérifié en servant le build avec `script-src 'self'` (une seule
 * violation, toujours la même ; le bloc `application/ld+json` n'est pas soumis
 * à cette directive, contrairement à ce qu'on pourrait croire).
 *
 * Vercel réécrit les routes et ne produit jamais l'adresse que ce script
 * décode. Le retirer **là-bas seulement** supprime la dernière raison
 * d'`'unsafe-inline'` sans toucher au retour à GitHub Pages que `deploy.yml`
 * garde ouvert : hors Vercel, le script reste.
 *
 * ## Pourquoi retirer la balise `<meta>`
 *
 * Une politique en `<meta>` **ignore** `report-uri`, `report-to` et
 * `frame-ancestors` — c'est d'ailleurs pourquoi `frame-ancestors` était déjà
 * servi à part, et pourquoi deux politiques se superposaient. Sur Vercel, la
 * seule politique est celle de `vercel.json`, entière.
 *
 * Hors Vercel, la balise reste : un hébergement de fichiers statiques ne sait
 * pas émettre d'en-tête, et une politique amoindrie y vaut mieux qu'aucune.
 *
 * ⚠️ `style-src` garde `'unsafe-inline'`, et c'est délibéré : `inlineCssPlugin`
 * remplace la feuille de style par un bloc `<style>`, et React pose des styles
 * calculés — le floutage des jaquettes réservées en dépend.
 */
const cspSansScriptInline = {
  name: 'csp-sans-script-inline',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html) {
      if (!surVercel) return html
      return html
        .replace(/<script data-hote="github-pages">[\s\S]*?<\/script>/, '')
        .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    },
  },
}

export default defineConfig({
  // GitHub Pages sert le site sous le nom du dépôt ; Vercel le sert à la racine.
  base: surVercel ? '/' : '/Anime-Ink/',
  plugins: [react(), tailwindcss(), inlineCssPlugin, page404Vercel, cspSansScriptInline],
  define: {
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
