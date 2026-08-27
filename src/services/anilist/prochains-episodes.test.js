import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerAdaptateurAniList } from '../anilist'

/**
 * Le prochain épisode de plusieurs séries, en une requête.
 *
 * Trois choses se jouent ici, et aucune ne se voit à la lecture du code :
 * l'unité de temps, la distinction entre « pas de prochain épisode » et
 * « série inconnue », et le fait qu'une liste ne consomme qu'**un** appel.
 */

const passeTout = { acquire: () => Promise.resolve() }

/** 30 août 2026, 17 h 00 UTC — en secondes, comme l'API les compte. */
const QUAND = Math.floor(Date.UTC(2026, 7, 30, 17, 0, 0) / 1000)

function reponse(media) {
  return new Response(JSON.stringify({ data: { Page: { media } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function adaptateur() {
  return creerAdaptateurAniList({ limiter: passeTout })
}

describe('prochains épisodes', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('date le prochain épisode dans la bonne unité', async () => {
    fetch.mockImplementation(async () => reponse([
      { idMal: 21, status: 'RELEASING', episodes: null, nextAiringEpisode: { episode: 1176, airingAt: QUAND } },
    ]))

    const carte = await adaptateur().getProchainsEpisodes([21])

    // L'API compte en secondes, JavaScript en millisecondes. Oublier ce facteur
    // mille ne fait pas planter : ça situe toutes les sorties en janvier 1970,
    // et l'écran affiche des dates absurdes sans qu'aucune erreur ne survienne.
    expect(carte.get(21).prochain).toEqual({ numero: 1176, dateISO: '2026-08-30T17:00:00.000Z' })
  })

  it('distingue une série terminée d’une série inconnue', async () => {
    fetch.mockImplementation(async () => reponse([
      { idMal: 1, status: 'FINISHED', episodes: 26, nextAiringEpisode: null },
    ]))

    const carte = await adaptateur().getProchainsEpisodes([1, 999_999])

    // Terminée : présente, sans date. L'écran doit pouvoir dire « épisode 7
    // sur 26 » sans prétendre qu'un épisode arrive.
    expect(carte.has(1)).toBe(true)
    expect(carte.get(1).prochain).toBeNull()
    expect(carte.get(1).episodes).toBe(26)
    // Inconnue de la source : absente. Ce n'est pas la même chose, et
    // l'appelant doit pouvoir le voir.
    expect(carte.has(999_999)).toBe(false)
  })

  it('garde des identifiants numériques', async () => {
    fetch.mockImplementation(async () => reponse([
      { idMal: 21, status: 'RELEASING', episodes: null, nextAiringEpisode: { episode: 2, airingAt: QUAND } },
    ]))

    const carte = await adaptateur().getProchainsEpisodes([21])

    // Un objet ordinaire aurait transformé la clé en `'21'`, et la recherche
    // par `anime.mal_id` — un nombre — n'aurait rien trouvé.
    expect([...carte.keys()]).toEqual([21])
  })

  it('ne lance qu’une requête pour toute la liste', async () => {
    fetch.mockImplementation(async () => reponse([]))

    await adaptateur().getProchainsEpisodes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

    // Une requête par série coûterait un tiers du quota d'une minute pour une
    // liste de dix titres, à chaque visite.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('donne la même clé de cache quel que soit l’ordre de la liste', async () => {
    fetch.mockImplementation(async () => reponse([]))
    const { getProchainsEpisodes } = adaptateur()

    await getProchainsEpisodes([3, 1, 2])
    await getProchainsEpisodes([2, 3, 1])

    // Les identifiants sont triés avant d'entrer dans la clé : sans cela, deux
    // visites listant les mêmes séries dans un ordre différent occuperaient
    // deux entrées de cache et paieraient deux requêtes.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ne demande rien pour une liste vide', async () => {
    const carte = await adaptateur().getProchainsEpisodes([])

    expect(carte.size).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('signale ce qu’il n’a pas demandé au-delà du plafond', async () => {
    const alerte = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetch.mockImplementation(async () => reponse([]))

    await adaptateur().getProchainsEpisodes(Array.from({ length: 60 }, (_, i) => i + 1))

    // Un plafond muet ferait croire que les séries écartées n'ont pas de
    // prochain épisode, alors qu'on ne l'a simplement pas demandé.
    expect(alerte).toHaveBeenCalledOnce()
    expect(alerte.mock.calls[0][0]).toMatch(/60 séries suivies, 50 interrogées/)
  })

  it('ignore ce qui n’est pas un identifiant', async () => {
    fetch.mockImplementation(async () => reponse([]))

    await adaptateur().getProchainsEpisodes([1, null, undefined, 'abc', 2])

    const envoyes = JSON.parse(fetch.mock.calls[0][1].body).variables.ids
    expect(envoyes).toEqual([1, 2])
  })
})
