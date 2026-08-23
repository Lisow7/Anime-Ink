import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearJikanMemoryCache, getApiHealth, getTopAnime, JikanError, searchAnime } from './jikan'

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('client Jikan', () => {
  beforeEach(() => {
    clearJikanMemoryCache()
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
    expect(getApiHealth().status).toBe('unavailable')
  })

  it('déduplique deux requêtes identiques simultanées', async () => {
    fetch.mockResolvedValue(response({ data: [{ mal_id: 1 }] }))

    const [first, second] = await Promise.all([getTopAnime(), getTopAnime()])

    expect(first).toEqual(second)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('réutilise une réponse fraîche en mémoire', async () => {
    fetch.mockResolvedValue(response({ data: [{ mal_id: 1 }] }))

    await getTopAnime()
    await getTopAnime()

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('respecte les limites par seconde et par minute', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T00:00:00Z'))
    fetch.mockImplementation(() => Promise.resolve(response({ data: [] })))

    const requests = Promise.all(Array.from({ length: 61 }, (_, index) => getTopAnime(index + 1)))
    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(20_001)
    expect(fetch).toHaveBeenCalledTimes(60)

    await vi.advanceTimersByTimeAsync(40_000)
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(61)
    await vi.runAllTimersAsync()
    await requests
  }, 10_000)

  it('détecte une erreur Jikan présente dans un corps HTTP 200', async () => {
    fetch.mockResolvedValue(response({ status: 500, error: 'UpstreamException', message: 'MAL indisponible' }))

    await expect(getTopAnime()).rejects.toMatchObject({ name: 'JikanError', status: 500 })
  })

  it('sert la dernière réponse valide pendant une panne temporaire', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T00:00:00Z'))
    fetch.mockResolvedValueOnce(response({ data: [{ mal_id: 1 }] }))
    await getTopAnime()

    vi.setSystemTime(new Date('2026-08-23T00:06:00Z'))
    fetch.mockRejectedValue(new TypeError('Network error'))
    const fallback = getTopAnime()
    await vi.advanceTimersByTimeAsync(30_000)

    await expect(fallback).resolves.toEqual({ data: [{ mal_id: 1 }] })
    expect(getApiHealth().status).toBe('degraded')
  })

  it('respecte Retry-After puis réessaie après un 429', async () => {
    vi.useFakeTimers()
    fetch
      .mockResolvedValueOnce(response({ message: 'Slow down' }, 429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(response({ data: [] }))

    const request = getTopAnime()
    await vi.advanceTimersByTimeAsync(5_000)

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
