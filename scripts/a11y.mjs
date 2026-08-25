/**
 * Garde-fou d'accessibilité : axe-core sur le build de production, dans un vrai
 * navigateur.
 *
 * Le navigateur n'est pas un luxe. Un axe exécuté sous jsdom ne calcule aucune
 * mise en page et ne voit donc ni les contrastes ni les tailles de cible —
 * c'est-à-dire précisément les défauts que ce garde-fou doit empêcher de
 * revenir. Il serait vert en permanence et ne protégerait rien.
 *
 * Deux pièges de mesure sont neutralisés ici, chacun ayant déjà faussé un
 * relevé :
 *   - les couleurs sont animées ; mesurer sans délai de stabilisation relève
 *     des teintes intermédiaires et invente des violations ;
 *   - le menu mobile échappe entièrement à la mesure tant qu'il reste fermé.
 */
import { createRequire } from 'node:module'
import { preview } from 'vite'
import { chromium } from 'playwright'

const require = createRequire(import.meta.url)
const AXE = require.resolve('axe-core/axe.min.js')

const ROUTES = ['', 'catalogue', 'profil', 'mentions-legales', 'anime/16498']
const ROUTES_MOBILE = ['', 'catalogue', 'profil']
const THEMES = ['light', 'dark']
const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const BUREAU = { width: 1280, height: 900 }
const MOBILE = { width: 390, height: 844 }
const STABILISATION_MS = 2500

async function analyser(page, base, { theme, route, mobile }) {
  await page.setViewportSize(mobile ? MOBILE : BUREAU)
  await page.goto(`${base}${route}`, { waitUntil: 'load' })
  await page.evaluate(t => document.documentElement.classList.toggle('light', t === 'light'), theme)
  await page.waitForTimeout(STABILISATION_MS)

  if (mobile) {
    await page.evaluate(() => {
      const bouton = [...document.querySelectorAll('nav button')]
        .find(b => /menu/i.test(b.getAttribute('aria-label') || ''))
      bouton?.click()
    })
    await page.waitForTimeout(700)
  }

  await page.addScriptTag({ path: AXE })
  return page.evaluate(async (normes) => {
    const resultat = await window.axe.run(document, { runOnly: { type: 'tag', values: normes } })
    return resultat.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      noeuds: v.nodes.length,
      cible: v.nodes[0]?.target?.join(' '),
      message: v.nodes[0]?.any?.[0]?.message ?? v.nodes[0]?.failureSummary ?? '',
    }))
  }, NORMES)
}

const serveur = await preview({ preview: { port: 4173, strictPort: true } })
const base = serveur.resolvedUrls.local[0]
const navigateur = await chromium.launch()
const page = await navigateur.newPage()

const passes = []
for (const theme of THEMES) {
  for (const route of ROUTES) passes.push({ theme, route, mobile: false })
  for (const route of ROUTES_MOBILE) passes.push({ theme, route, mobile: true })
}

let total = 0
try {
  for (const passe of passes) {
    const violations = await analyser(page, base, passe)
    const noeuds = violations.reduce((somme, v) => somme + v.noeuds, 0)
    total += noeuds

    const vue = passe.mobile ? 'mobile, menu ouvert' : 'bureau'
    const nom = `${passe.theme} · ${passe.route || 'accueil'} · ${vue}`
    if (noeuds === 0) {
      console.log(`  ok    ${nom}`)
    } else {
      console.log(`  ÉCHEC ${nom} — ${noeuds} nœud(s)`)
      for (const v of violations) {
        console.log(`        ${v.id} (${v.impact}) ×${v.noeuds} — ${v.cible}`)
        console.log(`        ${v.message}`)
      }
    }
  }
} finally {
  await navigateur.close()
  await serveur.close()
}

console.log(`\n${passes.length} passes, ${total} nœud(s) en violation.`)
if (total > 0) {
  console.error('Accessibilité : régression détectée.')
  process.exit(1)
}
console.log('Accessibilité : conforme.')
