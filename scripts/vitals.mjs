/**
 * Mesure le décalage de mise en page, sur les pages et les formats qui comptent.
 *
 * ## Pourquoi ce script existe
 *
 * Le décalage de mise en page — ce moment où le contenu se déplace sous les
 * yeux pendant le chargement — ne se voit dans aucun test. Les parcours
 * attendent que la page soit stable avant d'assurer quoi que ce soit ; c'est
 * précisément ce qui les rend fiables, et précisément ce qui les rend aveugles
 * à ce défaut-là.
 *
 * Il a donc fallu le mesurer trois fois de suite en réécrivant l'outil de
 * mémoire, avec à chaque fois des adresses et des formats codés en dur qui
 * n'étaient pas les mêmes. Ce script est cet outil, écrit une bonne fois.
 *
 * ## Ce qu'il mesure, et ce qu'il ne mesure pas
 *
 * Il rend le **CLS** : la somme des déplacements d'éléments déjà visibles,
 * pondérée par la surface touchée. Le seuil retenu est 0,1, celui de Google.
 *
 * Il ne rend **pas** le LCP, et c'est délibéré : la première page chargée par
 * un navigateur neuf paie l'établissement de la connexion et affiche des
 * secondes qui n'ont aucun rapport avec le site. La mesure a déjà fait crier à
 * une régression de quatre secondes qui n'existait pas.
 *
 * ## Pourquoi il ne tourne pas dans la CI
 *
 * Parce qu'il dépend du réseau : les pages interrogent AniList. Un garde-fou
 * qui rougit quand un tiers est lent finit ignoré. Il se lance à la main, quand
 * on touche à un écran d'attente ou à une mise en page :
 *
 *     npm run vitals                          # le build local
 *     BASE=https://exemple.app npm run vitals -- --sans-serveur
 */
import { chromium, devices } from 'playwright'
import { preview } from 'vite'

/**
 * Les trois largeurs ne sont pas décoratives.
 *
 * 1440 et 412 sont les deux extrêmes habituels. **560 est le piège** : entre
 * 500 et 639 pixels, la fiche passe en ligne quand son écran d'attente restait
 * en colonne. Ni le bureau ni le mobile ne traversent cette bande, et le défaut
 * y est resté invisible jusqu'à ce qu'on l'y cherche.
 */
const FORMATS = [
  ['bureau    1440', { viewport: { width: 1440, height: 900 } }],
  ['charnière  560', { viewport: { width: 560, height: 900 } }],
  ['mobile     412', devices['Pixel 7']],
]

/** `/anime/1` — Cowboy Bebop : ancien, stable, toujours servi par la source. */
const PAGES = ['/', '/catalogue', '/comparer', '/profil', '/mentions-legales', '/anime/1']

const SEUIL = 0.1

const sansServeur = process.argv.includes('--sans-serveur')
const serveur = sansServeur ? null : await preview({ preview: { port: 4175, strictPort: true } })
const base = (process.env.BASE || serveur.resolvedUrls.local[0]).replace(/\/$/, '')

const navigateur = await chromium.launch()
let horsSeuil = 0

try {
  for (const [nom, options] of FORMATS) {
    // Contexte neuf par format, page neuve par adresse : une mesure de décalage
    // ne vaut que sur un premier chargement, jamais sur une page réchauffée.
    const contexte = await navigateur.newContext(options)
    console.log(`\n  ${nom}`)

    for (const chemin of PAGES) {
      const page = await contexte.newPage()

      // `buffered: true` est indispensable : les premiers décalages surviennent
      // avant que le script d'observation n'ait pu être évalué autrement.
      await page.addInitScript(() => {
        window.__cls = 0
        new PerformanceObserver(liste => {
          for (const entree of liste.getEntries()) {
            // Un décalage qui suit un clic ou une frappe est voulu par la
            // personne : le compter accuserait le site d'avoir obéi.
            if (!entree.hadRecentInput) window.__cls += entree.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })

      await page.goto(base + chemin, { waitUntil: 'networkidle', timeout: 60_000 })
      await page.waitForTimeout(3000)
      // Descendre déclenche ce qui ne se charge qu'à l'approche : sans ce
      // défilement, la moitié basse des pages ne serait jamais mesurée.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1500)

      const cls = await page.evaluate(() => window.__cls)
      const tenu = cls <= SEUIL
      if (!tenu) horsSeuil += 1
      console.log(`    ${tenu ? 'ok  ' : 'HORS'} ${chemin.padEnd(18)} ${cls.toFixed(3)}`)
      await page.close()
    }

    await contexte.close()
  }
} finally {
  await navigateur.close()
  await serveur?.httpServer.close()
}

const total = FORMATS.length * PAGES.length
console.log(`\n${total} mesures, ${horsSeuil} au-dessus de ${SEUIL}.`)

if (horsSeuil > 0) {
  console.log(
    '\nUn décalage tient presque toujours à une hauteur réservée trop courte,'
    + '\nou à un écran d’attente dont la géométrie ne reproduit pas la page.'
    + '\n\n⚠️ Les rectangles rapportés par l’API sont COUPÉS À LA FENÊTRE : une'
    + '\nhauteur « 835 → 835 » ne veut pas dire que rien n’a grandi. Relever la'
    + '\nvraie hauteur avec `getBoundingClientRect()` avant de conclure — cette'
    + '\nconfusion a déjà coûté deux corrections inutiles.',
  )
  process.exit(1)
}

console.log('Aucune page ne saute au chargement.')
