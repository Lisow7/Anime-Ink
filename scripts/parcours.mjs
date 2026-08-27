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
import { SOURCE, cesserDeServir, servirSource } from './source-test.mjs'

const BUREAU = { width: 1280, height: 900 }

/** Réponses simulées, avec un jeu de genres explicites pour la censure. */
const HENTAI = [{ mal_id: 12, name: 'Hentai' }]

const servir = servirSource

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
      page.on('request', r => { if (SOURCE.estRequete(r.url())) requetes += 1 })
      await page.getByRole('button', { name: /r.essayer/i }).first().click()
      await page.waitForTimeout(3000)
      verifier(requetes > 0, 'le bouton « Réessayer » n’émet aucune requête')
    },
  },
  {
    nom: 'une panne ne vide pas un catalogue déjà consulté',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })
      await page.locator('main img[alt]').first().waitFor({ timeout: 15_000 })

      // Antidater l'entrée plutôt qu'attendre une heure : le secours ne
      // s'active qu'après expiration, et un test qui patiente n'en est pas un.
      const antidatee = await page.evaluate((prefixe) => {
        const cle = Object.keys(sessionStorage).find(k => k.includes(prefixe))
        if (!cle) return false
        const entree = JSON.parse(sessionStorage.getItem(cle))
        entree.expiresAt = Date.now() - 60_000
        sessionStorage.setItem(cle, JSON.stringify(entree))
        return true
      }, SOURCE.cleReserveCatalogue)
      verifier(antidatee, "aucune réponse de catalogue n'a été mise en réserve")

      // L'API tombe. La réserve est périmée — elle doit servir quand même.
      await cesserDeServir(page)
      await servir(page, { enPanne: true })
      await page.reload({ waitUntil: 'load' })
      await page.waitForTimeout(8000)

      const cartes = await page.locator('main img[alt]').count()
      const enErreur = await page.locator('main [role="alert"]').count()
      verifier(
        cartes > 0 && enErreur === 0,
        `panne survenue après consultation : ${cartes} carte(s) affichée(s), `
        + `${enErreur} écran(s) d'erreur — la dernière réponse connue devait être resservie`,
      )

      // Resservir une copie sans le dire laisserait croire qu'elle est fraîche.
      const mention = await page.locator('footer [role="status"]').first().innerText()
      verifier(
        /données du/i.test(mention),
        `le pied de page ne signale pas que les données sont datées : « ${mention.replace(/\s+/g, ' ')} »`,
      )
    },
  },
  {
    nom: 'les onglets locaux survivent à une panne de l’API',
    async executer(page, base) {
      // D'abord peupler l'historique pendant que l'API répond : la fiche l'écrit
      // toute seule, à condition d'avoir le consentement.
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })
      await page.getByRole('button', { name: /tout accepter/i }).click()
      await page.waitForTimeout(600)
      await page.goto(`${base}anime/1`, { waitUntil: 'load' })
      await page.locator('main h1').waitFor({ timeout: 15_000 })
      await page.waitForTimeout(800)

      const enregistres = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('anime-ink-history') || '[]').length } catch { return 0 }
      })
      verifier(enregistres > 0, "la visite d'une fiche n'a rien écrit dans l'historique")

      // L'API tombe. « Récents » ne lui doit rien : il doit rester debout, et
      // ne rien lui demander. Deux exigences distinctes — l'affichage tient aux
      // gardes de rendu, le silence réseau à la garde de l'effet. Les vérifier
      // séparément, sinon l'une masque l'échec de l'autre.
      await cesserDeServir(page)
      await servir(page, { enPanne: true })

      // Vider le cache de réponses, sans quoi la mesure serait trompeuse : la
      // requête du catalogue a déjà été servie plus haut, et le cache la
      // resservirait sans toucher au réseau. On mesurerait alors ce que le cache
      // épargne, pas ce que l'onglet demande.
      await page.evaluate(() => { try { sessionStorage.clear() } catch { /* stockage refusé */ } })

      const appels = []
      const noter = r => { if (SOURCE.estRequeteCatalogue(r)) appels.push(r.url()) }
      page.on('request', noter)

      await page.goto(`${base}catalogue?tab=recents`, { waitUntil: 'load' })
      await page.waitForTimeout(6000)
      page.off('request', noter)

      const cartes = await page.locator('main img[alt]').count()
      verifier(
        cartes > 0,
        "l'onglet « Récents » est vide alors qu'il ne dépend d'aucune requête : "
        + "une panne de l'API ne doit pas emporter des données locales",
      )

      const versCatalogue = appels
      verifier(
        versCatalogue.length === 0,
        `l'onglet « Récents » a interrogé le catalogue ${versCatalogue.length} fois `
        + "alors qu'il lit le stockage local — autant de requêtes prises sur un "
        + 'budget d\'une par seconde',
      )
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
