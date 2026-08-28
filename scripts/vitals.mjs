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

/**
 * Les pages, et **deux cas courts** qui ne sont pas là pour faire nombre.
 *
 * Le défaut ne vient pas seulement d'une page qui grandit : il vient aussi
 * d'une page qui reste **plus courte que l'écran d'attente**. Le pied de page
 * remonte alors dans le champ au lieu d'en sortir — le même décalage, à
 * l'envers. Mesuré avant correction : 0,031 sur écran large, 0,058 en mobile.
 *
 * Aucune des pages ordinaires ne l'aurait montré : elles dépassent toutes la
 * hauteur d'écran. C'est pourquoi la liste porte une fiche brève et une fiche
 * dont la source est injoignable.
 *
 * ⚠️ La fiche brève dépend d'un identifiant réel : si la source cessait de la
 * servir, ce cas basculerait silencieusement sur la branche d'erreur et ne
 * mesurerait plus ce qu'il annonce. C'est le cas « source injoignable », lui
 * déterministe, qui garantit la couverture — l'autre la complète.
 */
const CAS = [
  { chemin: '/' },
  { chemin: '/catalogue' },
  { chemin: '/comparer' },
  { chemin: '/profil' },
  { chemin: '/mentions-legales' },
  // Cowboy Bebop : ancien, stable, toujours servi. Synopsis long, bande-annonce
  // présente — la fiche la plus haute, donc le cas « la page grandit ».
  { chemin: '/anime/1', nom: '/anime/1  (fiche longue)' },
  // Saiki Kusuo : 88 caractères de synopsis, pas de bande-annonce.
  { chemin: '/anime/38249', nom: '/anime/38249  (fiche brève)' },
  { chemin: '/anime/1', nom: 'fiche, source injoignable', sourceEnPanne: true },
]

/**
 * Deux seuils, et ils ne font pas le même travail — comme les deux plafonds du
 * budget.
 *
 * **0,1 est la limite de Google.** C'est ce au-delà de quoi une page est dite
 * instable. Le site en est loin.
 *
 * **0,03 est le cliquet du dépôt.** Il existe parce que le seuil de Google ne
 * garde rien : les deux défauts trouvés le 29 août — le pied de page qui
 * remonte sur une fiche brève, et sur l'écran d'erreur — valaient 0,031 et
 * 0,058. Tous deux **sous** 0,1. Un banc réglé sur la seule limite tolérable
 * les aurait affichés en vert.
 *
 * Le maximum constaté aujourd'hui est 0,013, et il s'est révélé stable d'une
 * exécution à l'autre. La marge est donc du simple au double.
 *
 * ⚠️ Si ce cliquet rougit, la réponse est de mesurer une seconde fois, pas de
 * le relever : un cliquet qu'on desserre pour le faire taire ne garde plus rien.
 */
const LIMITE = 0.1
const CLIQUET = 0.03

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

    for (const { chemin, nom: libelle, sourceEnPanne } of CAS) {
      const page = await contexte.newPage()

      // Couper la source plutôt que d'espérer une panne : c'est le seul moyen
      // d'atteindre l'écran d'erreur, qui est la page la plus courte du site.
      if (sourceEnPanne) await page.route('**/graphql.anilist.co/**', route => route.abort())

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

      // Une source coupée fait échouer la navigation avant sa fin : c'est
      // attendu, et la page rend son écran d'erreur — qui est ce qu'on mesure.
      await page.goto(base + chemin, { waitUntil: 'networkidle', timeout: 60_000 })
        .catch(erreur => { if (!sourceEnPanne) throw erreur })
      await page.waitForTimeout(3000)
      // Descendre déclenche ce qui ne se charge qu'à l'approche : sans ce
      // défilement, la moitié basse des pages ne serait jamais mesurée.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(1500)

      const cls = await page.evaluate(() => window.__cls)
      const verdict = cls > LIMITE ? 'HORS' : cls > CLIQUET ? 'RECUL' : 'ok   '
      if (cls > CLIQUET) horsSeuil += 1
      console.log(`    ${verdict} ${(libelle ?? chemin).padEnd(28)} ${cls.toFixed(3)}`)
      await page.close()
    }

    await contexte.close()
  }
} finally {
  await navigateur.close()
  await serveur?.httpServer.close()
}

const total = FORMATS.length * CAS.length
console.log(`\n${total} mesures, ${horsSeuil} au-dessus du cliquet (${CLIQUET}).`)

if (horsSeuil > 0) {
  console.log(
    '\nUn décalage tient presque toujours à une hauteur réservée trop courte,'
    + '\nou à un écran d’attente dont la géométrie ne reproduit pas la page.'
    + '\n\n⚠️ Le défaut joue DANS LES DEUX SENS. Une page plus COURTE que son'
    + '\nécran d’attente fait REMONTER le pied de page dans le champ au lieu de'
    + '\nl’en faire sortir — c’est ce que mesurent la fiche brève et la fiche à'
    + '\nsource injoignable. Le plancher qui l’en empêche est posé UNE FOIS sur'
    + '\n`#contenu`, dans App.jsx ; le retirer le réintroduit sur tout le site.'
    + '\n\n⚠️ Les rectangles rapportés par l’API sont COUPÉS À LA FENÊTRE : une'
    + '\nhauteur « 835 → 835 » ne veut pas dire que rien n’a grandi. Relever la'
    + '\nvraie hauteur avec `getBoundingClientRect()` avant de conclure — cette'
    + '\nconfusion a déjà coûté deux corrections inutiles.',
  )
  process.exit(1)
}

console.log('Aucune page ne saute au chargement.')
