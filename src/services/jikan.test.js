import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearApiCache, getAnimeById, getAnimeSeasons, getApiHealth, getTopAnime, JikanError, searchAnime } from './jikan'

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('client Jikan', () => {
  beforeEach(() => {
    // Le cache de réponses est un singleton de module : sans purge, un test
    // servirait la réponse mémorisée par le précédent.
    clearApiCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retourne les données et publie un état disponible', async () => {
    fetch.mockResolvedValue(response({ data: [{ mal_id: 1 }] }))

    await expect(getTopAnime()).resolves.toEqual({ data: [{ mal_id: 1 }] })
    expect(getApiHealth().status).toBe('available')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('remonte une erreur structurée sur une réponse non récupérable', async () => {
    fetch.mockResolvedValue(response({ message: 'Not found' }, 404))

    await expect(getTopAnime()).rejects.toMatchObject({ name: 'JikanError', status: 404 })
    // Un 404 dit que la fiche demandée n'existe pas, pas que la source est
    // tombée. Allumer le voyant rouge parce qu'un utilisateur a ouvert un lien
    // périmé lui ferait croire à une panne qui n'a pas lieu.
    expect(getApiHealth().status).not.toBe('unavailable')
  })

  it('signale la source indisponible sur une erreur serveur', async () => {
    // Faux timers obligatoires : un 5xx est réessayé, et laisser s'écouler les
    // attentes réelles ferait expirer le test — puis épuiserait le limiteur,
    // que les cas suivants partagent.
    vi.useFakeTimers()
    fetch.mockImplementation(async () => response({ message: 'Bad gateway' }, 502))

    const requete = getTopAnime()
    const verdict = expect(requete).rejects.toMatchObject({ name: 'JikanError', status: 502 })
    await vi.runAllTimersAsync()
    await verdict

    expect(getApiHealth().status).toBe('unavailable')
  })

  it('respecte Retry-After puis réessaie après un 429', async () => {
    vi.useFakeTimers()
    fetch
      .mockResolvedValueOnce(response({ message: 'Slow down' }, 429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(response({ data: [] }))

    const request = getTopAnime()
    await vi.runAllTimersAsync()

    await expect(request).resolves.toEqual({ data: [] })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(getApiHealth().status).toBe('available')
  })

  it('annule une recherche obsolète', async () => {
    fetch.mockImplementation((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const controller = new AbortController()
    const request = searchAnime('Naruto', controller.signal)
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('expose le type JikanError', () => {
    expect(new JikanError('test')).toBeInstanceOf(Error)
  })
})

describe('remontée de franchise', () => {
  beforeEach(() => {
    clearApiCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('borne la remontée pour ne pas épuiser le budget de requêtes', async () => {
    // Franchise artificielle de 20 saisons enchaînées : 1 → 2 → … → 20.
    fetch.mockImplementation(async (url) => {
      const id = Number(String(url).match(/\/anime\/(\d+)\/full/)[1])
      return response({
        data: {
          mal_id: id,
          type: 'TV',
          episodes: 12,
          relations: id < 20
            ? [{ relation: 'Sequel', entry: [{ type: 'anime', mal_id: id + 1 }] }]
            : [],
        },
      })
    })

    vi.useFakeTimers()
    const pending = getAnimeSeasons(1, 12)
    await vi.runAllTimersAsync()
    const seasons = await pending

    expect(seasons.length).toBeLessThanOrEqual(6)
    expect(fetch.mock.calls.length).toBeLessThanOrEqual(12)
  })
})

describe('contournement du cache par action explicite', () => {
  beforeEach(() => {
    clearApiCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Un 404 n'est pas réessayé : une tentative par appel, ce qui isole le cache
  // négatif de la politique de retry et garde le test rapide.
  it('rejoue une fiche en échec quand l’utilisateur redemande explicitement', async () => {
    fetch.mockResolvedValue(response({ status: 404 }, 404))

    await expect(getAnimeById(1)).rejects.toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)

    // Sans contournement : l'échec mémorisé répond, aucune requête de plus.
    await expect(getAnimeById(1)).rejects.toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)

    // Avec contournement : on repart au réseau.
    await expect(getAnimeById(1, undefined, { bypassCache: true }))
      .rejects.toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
