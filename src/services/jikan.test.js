import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getApiHealth, getTopAnime, JikanError, searchAnime } from './jikan'

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

describe('client Jikan', () => {
  beforeEach(() => {
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
