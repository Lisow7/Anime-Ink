import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCache } from './cache'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function fakeSessionStorage({ failOnWrite = false } = {}) {
  const data = new Map()
  return {
    get length() { return data.size },
    key: index => [...data.keys()][index] ?? null,
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failOnWrite) {
        const error = new Error('quota dépassé')
        error.name = 'QuotaExceededError'
        throw error
      }
      data.set(key, value)
    },
    removeItem: key => { data.delete(key) },
  }
}

describe('cache de réponses', () => {
  it('rend la valeur avant expiration et plus rien après', () => {
    vi.useFakeTimers()
    const cache = createCache()

    cache.set('/anime/1/full', { title: 'Cowboy Bebop' }, 1000)
    expect(cache.get('/anime/1/full')).toEqual({ title: 'Cowboy Bebop' })

    vi.advanceTimersByTime(1001)
    expect(cache.get('/anime/1/full')).toBeUndefined()
  })

  it('évince la moins récemment utilisée au-delà de sa capacité', () => {
    const cache = createCache({ maxEntries: 2 })

    cache.set('a', 1, 10_000)
    cache.set('b', 2, 10_000)
    cache.get('a') // « a » redevient la plus récemment utilisée, « b » la plus ancienne
    cache.set('c', 3, 10_000)

    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('a')).toBe(1)
    expect(cache.get('c')).toBe(3)
  })

  it('survit à un rechargement en relisant sessionStorage', () => {
    vi.stubGlobal('sessionStorage', fakeSessionStorage())

    createCache().set('/anime/1/full', { title: 'Cowboy Bebop' }, 10_000)

    const afterReload = createCache()
    expect(afterReload.get('/anime/1/full')).toEqual({ title: 'Cowboy Bebop' })
  })

  it('ne propage pas une saturation de quota et garde la mémoire opérante', () => {
    vi.stubGlobal('sessionStorage', fakeSessionStorage({ failOnWrite: true }))
    const cache = createCache()

    expect(() => cache.set('/anime/1/full', { title: 'X' }, 10_000)).not.toThrow()
    expect(cache.get('/anime/1/full')).toEqual({ title: 'X' })
  })

  it('se vide entièrement sur demande, miroir compris', () => {
    const storage = fakeSessionStorage()
    vi.stubGlobal('sessionStorage', storage)
    storage.setItem('un-autre-usage', 'à préserver')

    const cache = createCache()
    cache.set('/anime/1/full', { title: 'X' }, 10_000)
    cache.clear()

    expect(cache.get('/anime/1/full')).toBeUndefined()
    expect(createCache().get('/anime/1/full')).toBeUndefined()
    expect(storage.getItem('un-autre-usage')).toBe('à préserver')
  })

  it('fonctionne quand sessionStorage est absent', () => {
    const cache = createCache()

    cache.set('/anime/1/full', { title: 'X' }, 10_000)
    expect(cache.get('/anime/1/full')).toEqual({ title: 'X' })
  })
})

describe('secours périmé', () => {
  it('rend une entrée expirée à qui la demande explicitement', () => {
    vi.useFakeTimers()
    const cache = createCache()

    cache.set('/top/anime', { data: [1, 2] }, 1000)
    vi.advanceTimersByTime(1500)

    expect(cache.get('/top/anime')).toBeUndefined()
    expect(cache.getStale('/top/anime')).toEqual({ data: [1, 2] })
  })

  it('cesse de la rendre passé le délai de grâce', () => {
    vi.useFakeTimers()
    const cache = createCache({ graceMs: 60_000 })

    cache.set('/top/anime', { data: [1] }, 1000)
    vi.advanceTimersByTime(1000 + 60_000 + 1)

    expect(cache.getStale('/top/anime')).toBeUndefined()
  })

  it('ne rend rien pour une clé jamais mise en cache', () => {
    const cache = createCache()
    expect(cache.getStale('/jamais/vue')).toBeUndefined()
  })

  it('retrouve une entrée expirée dans le miroir de session', () => {
    vi.useFakeTimers()
    const storage = fakeSessionStorage()
    vi.stubGlobal('sessionStorage', storage)

    const premier = createCache()
    premier.set('/anime?page=1', { data: ['a'] }, 1000)
    vi.advanceTimersByTime(1500)

    // Un cache neuf : rien en mémoire, tout à retrouver dans le miroir.
    const second = createCache()
    expect(second.get('/anime?page=1')).toBeUndefined()
    expect(second.getStale('/anime?page=1')).toEqual({ data: ['a'] })
  })

  it('oublie l’entrée du miroir une fois la grâce écoulée', () => {
    vi.useFakeTimers()
    const storage = fakeSessionStorage()
    vi.stubGlobal('sessionStorage', storage)

    const cache = createCache({ graceMs: 60_000 })
    cache.set('/anime?page=1', { data: ['a'] }, 1000)
    vi.advanceTimersByTime(1000 + 60_000 + 1)

    expect(cache.getStale('/anime?page=1')).toBeUndefined()
    expect(storage.getItem('anime-ink-cache:/anime?page=1')).toBeNull()
  })
})

describe('date de mise en réserve', () => {
  it('retient le moment où la réponse a été rangée', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T10:00:00Z'))
    const cache = createCache()

    cache.set('/top/anime', { data: [1] }, 1000)
    vi.advanceTimersByTime(5000)

    expect(cache.staleDate('/top/anime')).toBe(new Date('2026-08-27T10:00:00Z').getTime())
  })

  it('ne date rien qui n’a pas été mis en réserve', () => {
    const cache = createCache()
    expect(cache.staleDate('/jamais/vue')).toBeUndefined()
  })
})
