import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerAdaptateurAniList } from '../anilist'
import { creerReseauAniList, quotaConnu } from './reseau'
import { createCache } from '../jikan/cache'
import { cleDeRequete, ttlPourCle } from './requetes'

/**
 * Les briques héritées, éprouvées sur la nouvelle source.
 *
 * Le critère de la phase 3 : cache, déduplication et secours périmé doivent
 * fonctionner **inchangés**. Ce sont eux qui font tenir le site pendant une
 * panne — les réécrire pour GraphQL aurait été le meilleur moyen de perdre en
 * chemin ce qui a été gagné.
 */

const MEDIA = {
  idMal: 1,
  title: { romaji: 'Cowboy Bebop' },
  coverImage: { large: 'https://s4.anilist.co/x.png' },
  averageScore: 86,
  format: 'TV',
  status: 'FINISHED',
  genres: ['Action'],
  isAdult: false,
}

function reponse(corps, status = 200, headers = {}) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** Limiteur transparent : ces tests portent sur le cache, pas sur le débit. */
const passeTout = { acquire: () => Promise.resolve() }

describe('AniList branché sur les briques héritées', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('ne redemande pas ce qu’il a déjà — le cache', async () => {
    fetch.mockImplementation(async () => reponse({ data: { Media: MEDIA } }))
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout })

    await getAnimeById(1)
    await getAnimeById(1)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ne lance qu’une requête pour deux appels concurrents — la déduplication', async () => {
    fetch.mockImplementation(async () => reponse({ data: { Media: MEDIA } }))
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout })

    const [a, b] = await Promise.all([getAnimeById(1), getAnimeById(1)])

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(a.title).toBe('Cowboy Bebop')
    expect(b.title).toBe('Cowboy Bebop')
  })

  it('ressert la dernière réponse connue quand l’API tombe — le secours périmé', async () => {
    vi.useFakeTimers()
    const cache = createCache()
    fetch.mockImplementationOnce(async () => reponse({ data: { Media: MEDIA } }))
      .mockImplementation(async () => reponse({ message: 'panne' }, 504))

    // Sans reprises : sous faux timers, leur attente ne s'écoulerait jamais.
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout, cache, retries: 0 })

    expect((await getAnimeById(1)).title).toBe('Cowboy Bebop')
    // Au-delà de la durée de validité, mais dans le délai de grâce.
    vi.advanceTimersByTime(25 * 60 * 60 * 1000 - 60_000)

    expect((await getAnimeById(1)).title).toBe('Cowboy Bebop')
    vi.useRealTimers()
  })

  it('distingue deux requêtes qui ne diffèrent que par leurs variables', async () => {
    fetch.mockImplementation(async () => reponse({ data: { Media: MEDIA } }))
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout })

    await getAnimeById(1)
    await getAnimeById(2)

    // Une clé qui ignorerait les variables servirait la fiche 1 pour la 2.
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('donne la même clé quel que soit l’ordre d’écriture des variables', () => {
    // L'ordre des clés d'un objet ne dit rien de son contenu : sans tri, la
    // même requête occuperait deux entrées de cache.
    expect(cleDeRequete('catalogue', { page: 1, sort: 'X' }))
      .toBe(cleDeRequete('catalogue', { sort: 'X', page: 1 }))
  })

  it('n’attribue aucune durée de validité à une opération inconnue', () => {
    // Mieux vaut une requête de trop qu'une réponse imprévue mise en réserve.
    expect(ttlPourCle('inconnue:{}')).toBe(0)
    expect(ttlPourCle('media:{"idMal":1}')).toBeGreaterThan(0)
  })
})

describe('les particularités d’AniList', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('traite une erreur GraphQL rendue avec un statut 200', async () => {
    // AniList répond 200 en portant `errors` dans le corps. S'en remettre au
    // code HTTP mettrait cette erreur en cache comme une réponse valide.
    fetch.mockImplementation(async () => reponse({ errors: [{ message: 'Not Found', status: 404 }] }))
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout })

    await expect(getAnimeById(999_999)).rejects.toMatchObject({ status: 404 })
  })

  it('ne sert jamais une erreur GraphQL comme une donnée', async () => {
    fetch.mockImplementation(async () => reponse({ errors: [{ message: 'refusé', status: 400 }] }))
    const { getAnimeById } = creerAdaptateurAniList({ limiter: passeTout, retries: 0 })

    // Deux fois de suite : le second appel est rejeté par l'échec mémorisé,
    // sans repartir au réseau. C'est voulu — s'acharner sur une API qui refuse
    // ne fait que consommer le quota. Ce qui compte, c'est que l'erreur soit
    // rejetée et jamais rendue comme une fiche.
    await expect(getAnimeById(1)).rejects.toMatchObject({ status: 400 })
    await expect(getAnimeById(1)).rejects.toMatchObject({ status: 400 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retient ce que l’en-tête dit du quota', async () => {
    fetch.mockImplementation(async () => reponse(
      { data: { Media: MEDIA } },
      200,
      { 'X-RateLimit-Remaining': '17', 'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 30) },
    ))

    const interroger = creerReseauAniList()
    await interroger(cleDeRequete('media', { idMal: 1 }), {})

    // Jikan n'exposait aucun quota : le lire permet de ralentir avant le refus
    // plutôt que de le subir.
    expect(quotaConnu().restant).toBe(17)
    expect(quotaConnu().resetA).toBeGreaterThan(Date.now())
  })

  it('attend la fin de la fenêtre quand le quota est presque épuisé', async () => {
    const attentes = []
    const interroger = creerReseauAniList({ attendre: ms => { attentes.push(ms); return Promise.resolve() } })

    // Première réponse : il ne reste presque rien.
    fetch.mockImplementation(async () => reponse(
      { data: { Media: MEDIA } },
      200,
      { 'X-RateLimit-Remaining': '1', 'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 20) },
    ))
    await interroger(cleDeRequete('media', { idMal: 1 }), {})

    // La suivante doit patienter plutôt que de se faire refuser.
    await interroger(cleDeRequete('media', { idMal: 2 }), {})

    expect(attentes.length).toBe(1)
    expect(attentes[0]).toBeGreaterThan(0)
  })

  it('refuse une opération qui n’existe pas', async () => {
    const interroger = creerReseauAniList()
    await expect(interroger('inventee:{}', {})).rejects.toMatchObject({ status: 400 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
