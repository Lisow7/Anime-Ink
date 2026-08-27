/**
 * Parcours utilisateur, dans un vrai navigateur, sur le build de production.
 *
 * Les tests unitaires couvrent la couche réseau et les utilitaires. Les pages,
 * elles, n'avaient rien — et c'est là que vivaient les quatre défauts trouvés
 * en août 2026 : la recherche qui annonçait « aucun résultat » sur une panne,
 * l'animé surprise réduit à son titre, la liste de suivi qui ne floutait pas,
 * les suggestions servies en clair. Aucun test ne pouvait les voir.
 *
 * Ce script complète le garde-fou d'accessibilité, qui visite les pages sans
 * jamais vérifier ce qu'elles FONT.
 *
 * Les réponses de l'API sont simulées : la CI ne doit dépendre d'aucun tiers, et
 * Jikan tombe trop souvent pour qu'un échec de sa part fasse échouer un build.
 */
import { preview } from 'vite'
import { chromium } from 'playwright'
import { repondre } from './a11y-fixtures.mjs'

const BUREAU = { width: 1280, height: 900 }

/** Réponses simulées, avec un jeu de genres explicites pour la censure. */
const HENTAI = [{ mal_id: 12, name: 'Hentai' }]

function servir(page, { enPanne = false, genresImposes = null } = {}) {
  return page.route('**/api.jikan.moe/**', route => {
    if (enPanne) {
      return route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ status: 504, message: 'panne simulée' }),
      })
    }
    const corps = repondre(route.request().url())
    if (genresImposes && corps?.data) {
      corps.data = Array.isArray(corps.data)
        ? corps.data.map(a => ({ ...a, genres: genresImposes }))
        : { ...corps.data, genres: genresImposes }
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) })
  })
}

/** Lève avec un message lisible : un parcours muet ne sert à rien. */
function verifier(condition, message) {
  if (!condition) throw new Error(message)
}

const PARCOURS = [
  {
    nom: 'la recherche mène à une suggestion, et la suggestion à la fiche',
    async executer(page, base) {
      await servir(page)
      await page.goto(base, { waitUntil: 'load' })
      await page.getByRole('combobox', { name: /rechercher/i }).fill('Cowboy')

      const liste = page.locator('#suggestions-recherche li').first()
      await liste.waitFor({ timeout: 15_000 })
      const titre = (await liste.innerText()).split('\n')[0].trim()
      verifier(titre.length > 0, 'la première suggestion est vide')

      await liste.click()
      await page.locator('[role="dialog"]').waitFor({ timeout: 15_000 })
      const dansLaModale = await page.locator('[role="dialog"] h2').first().innerText()
      verifier(
        dansLaModale.trim().length > 0,
        `la modale s'ouvre sans titre après un clic sur « ${titre} »`,
      )
    },
  },
  {
    nom: 'un filtre du catalogue se retrouve dans l’URL et survit au rechargement',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const genre = page.locator('select[aria-label="Filtrer par genre"]')
      await genre.waitFor({ timeout: 15_000 })
      await page.locator('select[aria-label="Filtrer par statut"]').selectOption('airing')
      await page.waitForTimeout(1500)

      verifier(
        page.url().includes('status=airing'),
        `le filtre de statut n'apparaît pas dans l'URL : ${page.url()}`,
      )

      await page.reload({ waitUntil: 'load' })
      await page.waitForTimeout(1500)
      const valeur = await page.locator('select[aria-label="Filtrer par statut"]').inputValue()
      verifier(valeur === 'airing', `après rechargement le filtre vaut « ${valeur} » au lieu de « airing »`)
    },
  },
  {
    nom: 'un favori ajouté après consentement se retrouve dans son onglet',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      // Le consentement n'est pas un détail de mise en scène : sans lui, les
      // favoris ne sont pas écrits — `FavoritesContext` exige `userdata`. Un
      // parcours qui l'ignore teste le refus de stockage en croyant tester
      // l'ajout, et échoue pour une raison qui n'est pas la sienne.
      await page.getByRole('button', { name: /tout accepter/i }).click()
      await page.waitForTimeout(600)

      const bouton = page.getByRole('button', { name: /ajouter aux favoris/i }).first()
      await bouton.waitFor({ timeout: 15_000 })
      await bouton.click()
      await page.waitForTimeout(800)

      await page.goto(`${base}catalogue?tab=favoris`, { waitUntil: 'load' })
      await page.waitForTimeout(1500)
      const cartes = await page.locator('main img[alt]').count()
      verifier(cartes > 0, "l'onglet Favoris est vide après un ajout consenti")
    },
  },
  {
    nom: 'sans consentement, aucun favori n’est écrit sur le poste',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const bouton = page.getByRole('button', { name: /ajouter aux favoris/i }).first()
      await bouton.waitFor({ timeout: 15_000 })
      await bouton.click()
      await page.waitForTimeout(800)

      const stocke = await page.evaluate(() => {
        try { return localStorage.getItem('anime-ink-favorites') } catch { return null }
      })
      verifier(
        stocke === null,
        `un favori a été écrit sans consentement : ${String(stocke).slice(0, 80)}`,
      )
    },
  },
  {
    nom: 'une panne de l’API se dit, et le bouton de reprise repart au réseau',
    async executer(page, base) {
      await servir(page, { enPanne: true })
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const alerte = page.locator('main [role="alert"]')
      await alerte.waitFor({ timeout: 25_000 })
      const texte = await alerte.innerText()
      verifier(
        /indisponible/i.test(texte),
        `le message de panne ne parle pas d'indisponibilité : « ${texte.replace(/\s+/g, ' ')} »`,
      )
      verifier(
        !/aucun|trouvé/i.test(texte),
        `une panne est annoncée comme une absence de résultat : « ${texte.replace(/\s+/g, ' ')} »`,
      )

      let requetes = 0
      page.on('request', r => { if (r.url().includes('api.jikan.moe')) requetes += 1 })
      await page.getByRole('button', { name: /r.essayer/i }).first().click()
      await page.waitForTimeout(3000)
      verifier(requetes > 0, 'le bouton « Réessayer » n’émet aucune requête')
    },
  },
  {
    nom: 'la censure floute le contenu explicite, et la lever le dévoile',
    async executer(page, base) {
      await servir(page, { genresImposes: HENTAI })
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const jaquette = page.locator('main img[alt]').first()
      await jaquette.waitFor({ timeout: 15_000 })
      const floutee = await jaquette.evaluate(el => getComputedStyle(el).filter)
      verifier(
        floutee.includes('blur'),
        `censure active, une jaquette explicite n'est pas floutée (filtre : ${floutee})`,
      )

      await page.getByRole('button', { name: /censur/i }).first().click()
      await page.waitForTimeout(1200)
      const nette = await jaquette.evaluate(el => getComputedStyle(el).filter)
      verifier(
        !nette.includes('blur'),
        `censure levée, la jaquette reste floutée (filtre : ${nette})`,
      )
    },
  },
  {
    nom: 'le sélecteur de genres ne propose aucun genre explicite sous censure',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const genre = page.locator('select[aria-label="Filtrer par genre"]')
      await genre.waitFor({ timeout: 15_000 })
      const options = await genre.locator('option').allInnerTexts()
      const explicites = options.filter(o => /hentai|ecchi|erotica/i.test(o))
      verifier(
        explicites.length === 0,
        `censure active, le menu propose : ${explicites.join(', ')}`,
      )
    },
  },
]

const serveur = await preview({ preview: { port: 4174, strictPort: true } })
const base = serveur.resolvedUrls.local[0]
const navigateur = await chromium.launch()

let echecs = 0

try {
  for (const parcours of PARCOURS) {
    // Contexte neuf : les favoris et la bannière de consentement ne doivent pas
    // fuir d'un parcours à l'autre.
    const contexte = await navigateur.newContext({ viewport: BUREAU })
    const page = await contexte.newPage()
    try {
      await parcours.executer(page, base)
      console.log(`  ok    ${parcours.nom}`)
    } catch (erreur) {
      echecs += 1
      console.log(`  ÉCHEC ${parcours.nom}`)
      console.log(`        ${erreur.message}`)
    } finally {
      await contexte.close()
    }
  }
} finally {
  await navigateur.close()
  await serveur.httpServer.close()
}

console.log(`\n${PARCOURS.length} parcours, ${echecs} en échec.`)
if (echecs > 0) {
  console.log('Parcours : régression détectée.')
  process.exit(1)
}
console.log('Parcours : conformes.')
