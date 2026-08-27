import { describe, expect, it, vi } from 'vitest'
import { creerClientReseau } from './client'
import { createCache } from './cache'

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** Limiteur transparent : les tests de cache et de déduplication ne portent pas sur le débit. */
function openLimiter() {
  return { acquire: () => Promise.resolve() }
}

/**
 * Faux réseau fidèle au contrat de `fetch` : il échoue immédiatement si le
 * signal est DÉJÀ annulé, et pas seulement sur l'événement `abort`. Sans cette
 * fidélité, une interruption abusive de la requête partagée passait inaperçue.
 */
function pendingFetch() {
  let settle
  const impl = vi.fn((path, init) => new Promise((resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    settle = resolve
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  }))
  return { impl, settle: value => settle(value) }
}

function makeClient(fetchImpl, options = {}) {
  return creerClientReseau({
    fetchImpl,
    limiter: openLimiter(),
    cache: createCache(),
    ttlFor: () => 60_000,
    ...options,
  })
}

describe('client réseau', () => {
  it('ne lance qu’une requête pour deux appels concurrents sur le même chemin', async () => {
    // Une Response ne se lit qu'une fois : le mock en fabrique une par appel,
    // comme le ferait le vrai réseau.
    const fetchImpl = vi.fn(async () => jsonResponse({ data: 'ok' }))
    const client = makeClient(fetchImpl)

    const [first, second] = await Promise.all([
      client.request('/anime/1/full'),
      client.request('/anime/1/full'),
    ])

    expect(first).toEqual({ data: 'ok' })
    expect(second).toEqual({ data: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('sert un appel ultérieur depuis le cache, sans toucher au réseau', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: 'ok' }))
    const client = makeClient(fetchImpl)

    await client.request('/anime/1/full')
    const second = await client.request('/anime/1/full')

    expect(second).toEqual({ data: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('ne met pas en cache une ressource dont la durée de validité est nulle', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: 'ok' }))
    const client = makeClient(fetchImpl, { ttlFor: () => 0 })

    await client.request('/random/anime')
    await client.request('/random/anime')

    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('lève une ErreurApi sans réessayer sur un 404', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'Not found' }, 404))
    const client = makeClient(fetchImpl)

    await expect(client.request('/anime/999999/full')).rejects.toMatchObject({
      name: 'ErreurApi',
      status: 404,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('réessaie un 504 puis rend la réponse', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 504 }, 504))
      .mockResolvedValueOnce(jsonResponse({ data: 'ok' }))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).resolves.toEqual({ data: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('abandonne après le nombre de tentatives prévu et ne met pas l’échec en cache positif', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 504 }, 504))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0, retries: 2 })

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ status: 504 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('ne s’acharne pas sur un échec récent', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 504 }, 504))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ status: 504 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ status: 504 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('rejoue un échec mis en cache quand l’appelant demande à contourner', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 504 }, 504))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ status: 504 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)

    // Un clic délibéré de l'utilisateur doit repartir au réseau.
    await expect(
      client.request('/anime/1/full', { bypassCache: true })
    ).rejects.toMatchObject({ status: 504 })
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('ne met jamais en cache négatif une ressource non cachable', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 504 }, 504))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0, ttlFor: () => 0 })

    await expect(client.request('/random/anime')).rejects.toMatchObject({ status: 504 })
    await expect(client.request('/random/anime')).rejects.toMatchObject({ status: 504 })

    // Le bouton « autre animé » doit rester vivant même quand l'API tousse.
    expect(fetchImpl).toHaveBeenCalledTimes(6)
  })

  it('réessaie une panne réseau puis rend la réponse', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ data: 'ok' }))
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).resolves.toEqual({ data: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('convertit une panne réseau persistante en ErreurApi', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ name: 'ErreurApi' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('laisse remonter une annulation sans la convertir ni la réessayer', async () => {
    const fetchImpl = vi.fn(async () => { throw new DOMException('Aborted', 'AbortError') })
    const client = makeClient(fetchImpl, { retryDelayFor: () => 0 })

    await expect(client.request('/anime/1/full')).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  // Catalogue annule sa recherche à chaque frappe. Si son abandon interrompait
  // la requête partagée, il ferait échouer les autres abonnés au même chemin.
  it('un abonné qui abandonne ne fait pas échouer les autres', async () => {
    const network = pendingFetch()
    const client = makeClient(network.impl)

    const controller = new AbortController()
    const abandoned = client.request('/anime/1/full', { signal: controller.signal })
    const kept = client.request('/anime/1/full')

    controller.abort()
    await expect(abandoned).rejects.toMatchObject({ name: 'AbortError' })

    network.settle(jsonResponse({ data: 'ok' }))
    await expect(kept).resolves.toEqual({ data: 'ok' })
    expect(network.impl).toHaveBeenCalledTimes(1)
  })

  it('interrompt la requête partagée quand plus personne ne l’attend', async () => {
    const seen = []
    const fetchImpl = vi.fn((path, init) => new Promise((resolve, reject) => {
      seen.push(init?.signal)
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
    }))
    const client = makeClient(fetchImpl)

    const controller = new AbortController()
    const only = client.request('/anime/1/full', { signal: controller.signal })
    controller.abort()

    await expect(only).rejects.toMatchObject({ name: 'AbortError' })
    expect(seen[0]?.aborted).toBe(true)
  })
})

describe('secours par la dernière réponse connue', () => {
  it('ressert la donnée périmée quand l’API tombe', async () => {
    vi.useFakeTimers()
    const cache = createCache()
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: 'frais' }))
      .mockResolvedValue(jsonResponse({ status: 504 }, 504))

    const client = makeClient(fetchImpl, { cache, retries: 0, ttlFor: () => 1000 })

    expect(await client.request('/top/anime')).toEqual({ data: 'frais' })
    vi.advanceTimersByTime(1500)

    // L'API est tombée : plutôt que de rejeter, on ressert ce qu'on a.
    expect(await client.request('/top/anime')).toEqual({ data: 'frais' })
    vi.useRealTimers()
  })

  it('ne ressert rien pour une ressource qui n’existe pas', async () => {
    const cache = createCache()
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 404 }, 404))
    const client = makeClient(fetchImpl, { cache, retries: 0 })

    // Un 404 est une réponse, pas une panne : servir une vieille copie
    // prétendrait que la ressource existe encore.
    await expect(client.request('/anime/999999/full')).rejects.toMatchObject({ status: 404 })
  })

  it('rejette normalement quand rien n’a jamais été mis en réserve', async () => {
    const cache = createCache()
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 504 }, 504))
    const client = makeClient(fetchImpl, { cache, retries: 0 })

    await expect(client.request('/top/anime')).rejects.toMatchObject({ status: 504 })
  })
})
