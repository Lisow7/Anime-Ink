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
  {
    nom: 'la section « Reprendre » montre la progression, avec ou sans date',
    async executer(page, base) {
      // Deux séries suivies : une qui diffuse encore, une terminée. La seconde
      // est le cas courant d'une liste de suivi — et celui qu'un jeu composé
      // uniquement de séries en cours n'éprouverait jamais.
      const SUIVIS = [
        { mal_id: 2, title: 'Sousou no Frieren', watchStatus: 'watching', currentEpisode: 7, episodes: null, genres: [], images: {} },
        { mal_id: 1, title: 'Cowboy Bebop', watchStatus: 'watching', currentEpisode: 3, episodes: 26, genres: [], images: {} },
      ]

      await servir(page)
      await page.addInitScript(liste => {
        try {
          localStorage.setItem('anime-ink-watchlist', JSON.stringify(liste))
          localStorage.setItem('anime-ink-cookie-consent', JSON.stringify({ preferences: true, userdata: true }))
        } catch { /* stockage refusé */ }
      }, SUIVIS)

      await page.goto(`${base}profil`, { waitUntil: 'load' })
      const section = page.locator('section', { has: page.getByRole('heading', { name: /reprendre/i }) })
      await section.waitFor({ timeout: 15_000 })
      const texte = (await section.innerText()).replace(/\s+/g, ' ')

      // La progression vient du stockage local : elle doit s'afficher quoi
      // qu'il arrive au réseau.
      verifier(/Cowboy Bebop/.test(texte), `« Reprendre » n'affiche pas la série suivie : « ${texte.slice(0, 120)} »`)
      verifier(/Épisode 3 sur 26/.test(texte), `la progression d'une série terminée manque : « ${texte.slice(0, 160)} »`)

      // La date, elle, dépend de ce que la source sait faire — c'est une
      // capacité, pas une promesse du contrat commun. AniList date les
      // épisodes ; l'API historique ne le sait pas, et la section doit alors
      // s'afficher SANS dates plutôt que de ne pas s'afficher.
      if (SOURCE.nom === 'anilist') {
        verifier(
          /Épisode 9/.test(texte),
          `la date du prochain épisode n'apparaît pas pour une série en diffusion : « ${texte.slice(0, 160)} »`,
        )
        verifier(
          !/Cowboy Bebop[^É]*Épisode 3 sur 26 Épisode \d/.test(texte),
          `une série terminée annonce un prochain épisode : « ${texte.slice(0, 200)} »`,
        )
      } else {
        verifier(
          !/Épisode \d+ (aujourd|demain|dans |le )/.test(texte),
          `une source qui ne sait pas dater les épisodes en annonce quand même : « ${texte.slice(0, 160)} »`,
        )
      }
    },
  },
  {
    // Le seul parcours qui parte d'un poste déjà habité. Tous les autres
    // démarrent d'un navigateur vierge, si bien qu'aucun ne verrait des
    // données écrites par une version antérieure du site — c'est-à-dire
    // exactement ce que traverse un utilisateur le jour d'une bascule de
    // source.
    nom: 'des favoris enregistrés avant la bascule survivent au changement de source',
    async executer(page, base) {
      const AVANT = [
        { mal_id: 1, title: 'Cowboy Bebop', images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg' } } },
        // Une œuvre que la source actuelle ne connaît pas : le cas qui décide
        // si la bascule perd des données ou se contente de ne pas les enrichir.
        { mal_id: 999_999, title: 'Un titre oublié', images: { jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg' } } },
      ]

      await servir(page)
      // Écrire avant le premier rendu : après coup, l'application a déjà lu le
      // stockage et l'onglet resterait vide pour une raison sans rapport.
      await page.addInitScript(favoris => {
        try {
          localStorage.setItem('anime-ink-favorites', JSON.stringify(favoris))
          // Sans consentement, les favoris ne sont pas lus : la bannière
          // masquerait l'échec qu'on cherche à observer.
          localStorage.setItem('anime-ink-cookie-consent', JSON.stringify({ preferences: true, userdata: true }))
        } catch { /* stockage refusé */ }
      }, AVANT)

      await page.goto(`${base}catalogue?tab=favoris`, { waitUntil: 'load' })
      await page.waitForTimeout(2500)

      const titres = await page.locator('main article, main .group').allInnerTexts()
      verifier(
        titres.some(t => /Cowboy Bebop/i.test(t)),
        'un favori enregistré avant la bascule a disparu de son onglet',
      )
      verifier(
        titres.some(t => /titre oublié/i.test(t)),
        "un favori que la nouvelle source ne connaît pas a été effacé : la bascule "
        + 'ne doit pas emporter des données que l’utilisateur a constituées',
      )

      // Et l'ouvrir doit s'expliquer plutôt que de laisser une fenêtre vide.
      await page.locator('main article, main .group').filter({ hasText: /titre oublié/i }).first().click()
      await page.waitForTimeout(3000)
      const modale = page.locator('[role="dialog"]')
      if (await modale.count() > 0) {
        const contenu = (await modale.first().innerText()).trim()
        verifier(
          contenu.length > 0,
          'la fiche d’un favori inconnu de la source ouvre une fenêtre vide et muette',
        )
      }
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
