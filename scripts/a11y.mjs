/**
 * Garde-fou d'accessibilité : axe-core sur le build de production, dans un vrai
 * navigateur.
 *
 * Le navigateur n'est pas un luxe. Un axe exécuté sous jsdom ne calcule aucune
 * mise en page et ne voit donc ni les contrastes ni les tailles de cible —
 * c'est-à-dire précisément les défauts que ce garde-fou doit empêcher de
 * revenir. Il serait vert en permanence et ne protégerait rien.
 *
 * Un garde-fou ne protège que ce qu'il VISITE. La première version ne parcourait
 * que les pages au repos, et déclarait « 0 violation » alors que les trois
 * interrupteurs de la modale de consentement n'avaient aucun nom accessible :
 * ils vivent derrière un clic, donc hors de son regard. D'où les scénarios
 * ci-dessous, qui ouvrent les modales et les vues secondaires.
 *
 * Chaque scénario déclare un `temoin` : un sélecteur qui DOIT être présent une
 * fois l'état atteint. Sans lui, un scénario dont la préparation échoue
 * analyserait la page au repos et passerait au vert en ne vérifiant rien.
 *
 * Deux pièges de mesure sont neutralisés : les couleurs sont animées, donc un
 * relevé sans délai de stabilisation invente des violations sur des teintes
 * intermédiaires ; et le menu mobile échappe à l'analyse tant qu'il est fermé.
 */
import { createRequire } from 'node:module'
import { preview } from 'vite'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')

const THEMES = ['light', 'dark']
const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const BUREAU = { width: 1280, height: 900 }
const MOBILE = { width: 390, height: 844 }
const STABILISATION_MS = 2500

const clic = selecteur => async (page) => {
  await page.locator(selecteur).first().click()
  await page.waitForTimeout(700)
}

/**
 * `temoin` : sélecteur attestant que l'état visé est bien atteint.
 * `prepare` : interaction menant à cet état.
 */
const SCENARIOS = [
  { nom: 'accueil', route: '' },
  { nom: 'catalogue', route: 'catalogue' },
  { nom: 'profil', route: 'profil' },
  { nom: 'mentions légales', route: 'mentions-legales' },
  { nom: 'fiche animé', route: 'anime/16498' },
  { nom: 'page inconnue', route: 'cette-route-nexiste-pas' },
  { nom: 'favoris vides', route: 'catalogue?tab=favoris' },
  { nom: 'accueil, menu mobile ouvert', route: '', mobile: true, temoin: 'nav a[href$="/profil"]' },
  { nom: 'catalogue, menu mobile ouvert', route: 'catalogue', mobile: true, temoin: 'nav a[href$="/profil"]' },
  {
    nom: 'modale de consentement',
    route: '',
    temoin: '[role="dialog"] [role="switch"]',
    prepare: clic('button:has-text("Personnaliser")'),
  },
  {
    nom: 'modale changelog',
    route: '',
    temoin: '[role="dialog"]',
    // La bannière de consentement est ancrée en bas et recouvre le pied de page :
    // il faut d'abord la lever, sinon le clic n'atteint jamais sa cible.
    prepare: async (page) => {
      await page.locator('button:has-text("Tout accepter")').click()
      await page.waitForTimeout(500)
      await page.locator('footer button:has-text("Voir les nouveautés")').click()
      await page.waitForTimeout(700)
    },
  },
  {
    nom: 'catalogue en vue liste',
    route: 'catalogue',
    temoin: 'button[aria-label*="liste" i], button[aria-pressed]',
    prepare: async (page) => {
      await page.evaluate(() => {
        try { localStorage.setItem('anime-ink-view', '"list"') } catch { /* stockage refusé */ }
      })
      await page.reload({ waitUntil: 'load' })
      await page.waitForTimeout(2000)
    },
  },
]

async function analyser(page, base, scenario) {
  await page.setViewportSize(scenario.mobile ? MOBILE : BUREAU)
  await page.goto(`${base}${scenario.route}`, { waitUntil: 'load' })
  await page.waitForTimeout(STABILISATION_MS)

  if (scenario.mobile) {
    await page.evaluate(() => {
      const bouton = [...document.querySelectorAll('nav button')]
        .find(b => /menu/i.test(b.getAttribute('aria-label') || ''))
      bouton?.click()
    })
    await page.waitForTimeout(700)
  }

  if (scenario.prepare) await scenario.prepare(page)

  if (scenario.temoin) {
    const present = await page.locator(scenario.temoin).count()
    if (present === 0) {
      throw new Error(
        `Scénario « ${scenario.nom} » : l'état visé n'a pas été atteint ` +
        `(témoin « ${scenario.temoin} » absent). Analyser la page au repos ` +
        `donnerait un vert trompeur.`
      )
    }
  }

  await page.addScriptTag({ path: AXE })
  return page.evaluate(async (normes) => {
    const resultat = await window.axe.run(document, { runOnly: { type: 'tag', values: normes } })
    return resultat.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      noeuds: v.nodes.length,
      cibles: v.nodes.slice(0, 5).map(n => n.target.join(' ')),
      message: v.nodes[0]?.any?.[0]?.message ?? v.nodes[0]?.failureSummary ?? '',
    }))
  }, NORMES)
}

const serveur = await preview({ preview: { port: 4173, strictPort: true } })
const base = serveur.resolvedUrls.local[0]
const navigateur = await chromium.launch()

let total = 0
let passes = 0
let echecPreparation = false

try {
  for (const theme of THEMES) {
    for (const scenario of SCENARIOS) {
      // Contexte neuf par scénario : la bannière de consentement et le cache de
      // session ne doivent pas fuir d'un scénario à l'autre.
      // Le thème est piloté par prefers-color-scheme, comme chez un vrai
      // utilisateur. Basculer la classe à la main était fragile : l'application
      // réapplique son propre thème dès que le consentement change, et écrasait
      // la bascule — les deux passes finissaient alors en clair sans le dire.
      const contexte = await navigateur.newContext({ colorScheme: theme })
      const page = await contexte.newPage()
      const nom = `${theme} · ${scenario.nom}`

      try {
        const violations = await analyser(page, base, scenario)
        passes += 1
        const noeuds = violations.reduce((somme, v) => somme + v.noeuds, 0)
        total += noeuds

        if (noeuds === 0) {
          console.log(`  ok    ${nom}`)
        } else {
          console.log(`  ÉCHEC ${nom} — ${noeuds} nœud(s)`)
          for (const v of violations) {
            console.log(`        ${v.id} (${v.impact}) ×${v.noeuds}`)
            console.log(`        ${v.message}`)
            // Plusieurs cibles : une seule masquerait les autres causes du même
            // symptôme, et enverrait corriger le mauvais élément.
            for (const cible of v.cibles) console.log(`          → ${cible}`)
          }
        }
      } catch (erreur) {
        echecPreparation = true
        console.log(`  ERREUR ${nom} — ${erreur.message}`)
      } finally {
        await contexte.close()
      }
    }
  }
} finally {
  await navigateur.close()
  await serveur.close()
}

console.log(`\n${passes} passes analysées, ${total} nœud(s) en violation.`)
if (echecPreparation) {
  console.error("Accessibilité : au moins un scénario n'a pas atteint son état.")
  process.exit(1)
}
if (total > 0) {
  console.error('Accessibilité : régression détectée.')
  process.exit(1)
}
console.log('Accessibilité : conforme.')
