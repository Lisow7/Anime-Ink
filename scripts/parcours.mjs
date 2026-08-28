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
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

      // La progression vient du stockage local et s'affiche aussitôt ; les
      // dates arrivent par le réseau, donc plus tard. Lire le texte dès que la
      // section paraît revient à mesurer une course — elle se gagne sur une
      // machine rapide et se perd en intégration continue.
      await section.getByText(/Épisode 9/).waitFor({ timeout: 15_000 })

      const texte = (await section.innerText()).replace(/\s+/g, ' ')

      // La progression vient du stockage local : elle doit s'afficher quoi
      // qu'il arrive au réseau.
      verifier(/Cowboy Bebop/.test(texte), `« Reprendre » n'affiche pas la série suivie : « ${texte.slice(0, 120)} »`)
      verifier(/Épisode 3 sur 26/.test(texte), `la progression d'une série terminée manque : « ${texte.slice(0, 160)} »`)

      // La date vient du réseau, et seulement pour ce qui diffuse encore.
      verifier(
        /Épisode 9/.test(texte),
        `la date du prochain épisode n'apparaît pas pour une série en diffusion : « ${texte.slice(0, 160)} »`,
      )
      verifier(
        !/Cowboy Bebop[^É]*Épisode 3 sur 26 Épisode \d/.test(texte),
        `une série terminée annonce un prochain épisode : « ${texte.slice(0, 200)} »`,
      )
    },
  },
  {
    nom: 'survoler une carte ne propose aucune sortie du site',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })
      const carte = page.locator('main article, main .group').first()
      await carte.waitFor({ timeout: 15_000 })
      await carte.hover()
      await page.waitForTimeout(1200)

      // Une carte survolée montrait la bande-annonce, et un clic emmenait sur
      // YouTube. La bande-annonce a sa place sur la fiche, pas au survol d'une
      // vignette : personne ne demande à quitter le site en promenant sa souris.
      verifier(
        await page.locator('main a[href*="youtube"], main a[href*="youtu.be"]').count() === 0,
        'une carte survolée propose encore un lien vers YouTube',
      )
      verifier(
        await page.locator('main img[src*="ytimg"], main img[src*="youtube"]').count() === 0,
        'une carte survolée charge encore une miniature YouTube',
      )
    },
  },
  {
    nom: 'la grille des mieux notés ne laisse pas de case vide',
    async executer(page, base) {
      await servir(page)
      await page.goto(base, { waitUntil: 'load' })
      await page.locator('main img[alt]').first().waitFor({ timeout: 15_000 })
      await page.waitForTimeout(2500)

      // Le regroupement des franchises réunit plusieurs entrées en une : en
      // découpant à six AVANT de grouper, il n'en restait parfois que cinq
      // dans une grille taillée pour six.
      const derniere = page.locator('main section').last()
      const cartes = await derniere.locator('article, .group').count()
      verifier(
        cartes === 6,
        `la grille des mieux notés affiche ${cartes} cartes au lieu de 6 — le regroupement en a mangé`,
      )
    },
  },
  {
    nom: 'suivre une série se découvre sans en suivre déjà une',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })
      await page.locator('main img[alt]').first().waitFor({ timeout: 15_000 })

      // L'onglet était masqué tant que la liste était vide : un nouveau venu ne
      // pouvait donc pas apprendre que suivre une série était possible.
      const onglet = page.getByRole('button', { name: /ma liste/i }).first()
      verifier(
        await onglet.count() > 0,
        'l’onglet « Ma liste » est introuvable pour qui n’a encore rien suivi',
      )

      await onglet.click()
      await page.waitForTimeout(2000)
      const texte = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
      verifier(
        /ouvre un anim/i.test(texte),
        `l'écran vide n'explique pas comment ajouter une série : « ${texte.slice(0, 160)} »`,
      )
    },
  },
  {
    nom: 'un filtre de saison entre dans l’URL et survit au rechargement',
    async executer(page, base) {
      await servir(page)
      await page.goto(`${base}catalogue`, { waitUntil: 'load' })

      const saison = page.locator('select[aria-label="Filtrer par saison"]')
      await saison.waitFor({ timeout: 15_000 })
      await saison.selectOption('ete')
      const annee = page.locator('select[aria-label="Filtrer par année"]')
      await annee.selectOption('2026')
      await page.waitForTimeout(1500)

      // L'URL est ce qui se partage et se met en signet : un filtre qui n'y
      // figure pas est perdu au premier rechargement.
      const url = new URL(page.url())
      verifier(url.searchParams.get('saison') === 'ete', `la saison n'est pas dans l'URL : ${page.url()}`)
      verifier(url.searchParams.get('annee') === '2026', `l'année n'est pas dans l'URL : ${page.url()}`)

      await page.reload({ waitUntil: 'load' })
      await saison.waitFor({ timeout: 15_000 })
      verifier(
        await saison.inputValue() === 'ete',
        'le menu de saison ne reprend pas la valeur portée par l’URL',
      )
      verifier(
        await annee.inputValue() === '2026',
        'le menu d’année ne reprend pas la valeur portée par l’URL',
      )

      // Et le filtre doit atteindre la source, sinon il ne fait qu'orner l'URL.
      const envoyees = []
      const noter = r => {
        if (!SOURCE.estRequete(r.url())) return
        try { envoyees.push(JSON.parse(r.postData() ?? '{}').variables ?? {}) } catch { /* corps illisible */ }
      }
      page.on('request', noter)
      await page.evaluate(() => { try { sessionStorage.clear() } catch { /* refusé */ } })
      await page.reload({ waitUntil: 'load' })
      await page.waitForTimeout(4000)
      page.off('request', noter)

      verifier(
        envoyees.some(v => v.season === 'SUMMER' && v.seasonYear === 2026),
        `la saison n'atteint pas la source : ${JSON.stringify(envoyees).slice(0, 200)}`,
      )

      // La durée suit le même chemin : une tranche dans l'URL, des bornes de
      // minutes dans la requête.
      envoyees.length = 0
      page.on('request', noter)
      await page.evaluate(() => { try { sessionStorage.clear() } catch { /* refusé */ } })
      const tranche = page.locator('select[aria-label="Filtrer par durée"]')
      await tranche.selectOption('court')
      await page.waitForTimeout(4000)
      page.off('request', noter)

      verifier(
        envoyees.some(v => Number.isFinite(v.dureeMax)),
        `la tranche de durée n'atteint pas la source : ${JSON.stringify(envoyees).slice(0, 200)}`,
      )
    },
  },
  {
    nom: 'les sorties de la semaine se groupent par jour',
    async executer(page, base) {
      await servir(page)
      await page.addInitScript(() => {
        try {
          localStorage.setItem('anime-ink-cookie-consent', JSON.stringify({ preferences: true, userdata: true }))
          // L'une diffuse encore, l'autre est terminée : seule la première a
          // une sortie à annoncer.
          localStorage.setItem('anime-ink-watchlist', JSON.stringify([
            { mal_id: 2, title: 'Sousou no Frieren', watchStatus: 'watching', currentEpisode: 7, episodes: null, genres: [], images: {} },
          ]))
          localStorage.setItem('anime-ink-favorites', JSON.stringify([
            { mal_id: 1, title: 'Cowboy Bebop', genres: [], images: {} },
          ]))
        } catch { /* stockage refusé */ }
      })

      await page.goto(`${base}profil`, { waitUntil: 'load' })
      const section = page.locator('section', { has: page.getByRole('heading', { name: /cette semaine/i }) })
      await section.waitFor({ timeout: 15_000 })
      await section.getByText(/Frieren/).waitFor({ timeout: 15_000 })

      const texte = (await section.innerText()).replace(/\s+/g, ' ')
      verifier(/ép\. 9/.test(texte), `le numéro d'épisode manque : « ${texte.slice(0, 140)} »`)

      // La série terminée n'a pas de prochaine diffusion : l'annoncer serait
      // inventer une sortie.
      verifier(
        !/Cowboy Bebop/.test(texte),
        `une série terminée figure au calendrier : « ${texte.slice(0, 160)} »`,
      )

      // Un en-tête de jour, sans quoi la vue n'est qu'une liste de plus.
      verifier(
        /(Aujourd|Demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(texte),
        `les sorties ne sont pas groupées par jour : « ${texte.slice(0, 160)} »`,
      )
    },
  },
  {
    nom: 'comparer deux animés fait ressortir ce qui les rapproche',
    async executer(page, base) {
      await servir(page)
      await page.addInitScript(() => {
        try {
          localStorage.setItem('anime-ink-cookie-consent', JSON.stringify({ preferences: true, userdata: true }))
          localStorage.setItem('anime-ink-favorites', JSON.stringify([
            { mal_id: 1, title: 'Cowboy Bebop', score: 8.7, episodes: 26, year: 1998, status: 'Terminé', genres: [{ name: 'Action' }, { name: 'Drame' }], images: {} },
            { mal_id: 4, title: 'Steins;Gate', score: 9.1, episodes: 24, year: 2011, status: 'Terminé', genres: [{ name: 'Drame' }, { name: 'Sci-Fi' }], images: {} },
          ]))
        } catch { /* stockage refusé */ }
      })

      await page.goto(`${base}comparer`, { waitUntil: 'load' })
      const premier = page.getByRole('button', { name: /Cowboy Bebop/ })
      await premier.waitFor({ timeout: 15_000 })
      await premier.click()
      await page.getByRole('button', { name: /Steins;Gate/ }).click()
      await page.waitForTimeout(1200)

      const texte = (await page.locator('main').innerText()).replace(/\s+/g, ' ')

      // La comparaison doit désigner, pas seulement juxtaposer.
      verifier(/9\.1 \/ 10/.test(texte), `les notes ne sont pas comparées : « ${texte.slice(0, 160)} »`)
      // `innerText` rend le texte TEL QU'AFFICHÉ : le titre est mis en
      // majuscules par la feuille de style, et une comparaison sensible à la
      // casse échouerait sur un écran pourtant correct.
      const communs = texte.slice(texte.search(/genres communs/i))
      verifier(/genres communs/i.test(texte), 'les genres communs ne sont pas dégagés')
      verifier(
        /drame/i.test(communs),
        `le genre partagé n'est pas isolé : « ${communs.slice(0, 90)} »`,
      )
      // Ce que les deux n'ont PAS en commun ne doit pas y figurer.
      verifier(
        !/sci-fi/i.test(communs) && !/action/i.test(communs),
        `un genre propre à un seul animé est présenté comme commun : « ${communs.slice(0, 90)} »`,
      )
    },
  },
  {
    nom: 'une sauvegarde se télécharge, et se restaure sans rien écraser',
    async executer(page, base) {
      await servir(page)
      await page.addInitScript(() => {
        try {
          localStorage.setItem('anime-ink-cookie-consent', JSON.stringify({ preferences: true, userdata: true }))
          localStorage.setItem('anime-ink-watchlist', JSON.stringify([
            { mal_id: 2, title: 'Frieren', watchStatus: 'watching', currentEpisode: 12, episodes: null, genres: [], images: {} },
          ]))
        } catch { /* stockage refusé */ }
      })

      await page.goto(`${base}profil`, { waitUntil: 'load' })
      const bloc = page.locator('section', { has: page.getByRole('heading', { name: /tes données/i }) })
      await bloc.waitFor({ timeout: 15_000 })

      const [fichier] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        bloc.getByRole('button', { name: /télécharger/i }).click(),
      ])
      const chemin = await fichier.path()
      verifier(Boolean(chemin), 'aucun fichier de sauvegarde n’a été produit')

      // Le fichier ne doit pas emporter le consentement : le restaurer
      // fabriquerait un accord que la personne n'a pas donné sur cette machine.
      const contenu = JSON.parse(readFileSync(chemin, 'utf8'))
      verifier(
        !/consent/i.test(JSON.stringify(contenu)),
        'la sauvegarde emporte le consentement aux cookies',
      )
      verifier(contenu.liste?.[0]?.currentEpisode === 12, 'la progression n’est pas dans la sauvegarde')

      // Antidater la sauvegarde et la réimporter : la progression locale, plus
      // avancée, doit survivre. C'est toute la promesse d'une restauration qui
      // complète au lieu de remplacer.
      const antidatee = join(dirname(chemin), 'antidatee.json')
      writeFileSync(antidatee, JSON.stringify({
        ...contenu,
        liste: [{ ...contenu.liste[0], currentEpisode: 3 }, { mal_id: 999, title: 'Titre restauré', images: {} }],
      }))

      await bloc.locator('input[type="file"]').setInputFiles(antidatee)
      await page.waitForTimeout(1500)

      const restant = await page.evaluate(() => {
        try { return JSON.parse(localStorage.getItem('anime-ink-watchlist') || '[]') } catch { return [] }
      })
      const frieren = restant.find(a => a.mal_id === 2)
      verifier(
        frieren?.currentEpisode === 12,
        `une restauration a fait reculer la progression : épisode ${frieren?.currentEpisode} au lieu de 12`,
      )
      verifier(
        restant.some(a => a.mal_id === 999),
        'la restauration n’a pas ajouté ce qui manquait',
      )
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
    const contexte = await navigateur.newContext({ viewport: BUREAU, acceptDownloads: true })
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
