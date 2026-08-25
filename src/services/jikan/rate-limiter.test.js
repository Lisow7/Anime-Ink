import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRateLimiter } from './rate-limiter'

afterEach(() => {
  vi.useRealTimers()
})

describe('limiteur à seau de jetons', () => {
  it('laisse passer une rafale égale à la capacité, puis un jeton par seconde', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ capacity: 3, refillPerSecond: 1 })

    const passed = []
    for (let i = 0; i < 5; i += 1) {
      limiter.acquire().then(() => passed.push(i))
    }

    await vi.advanceTimersByTimeAsync(0)
    expect(passed).toEqual([0, 1, 2])

    await vi.advanceTimersByTimeAsync(1000)
    expect(passed).toEqual([0, 1, 2, 3])

    await vi.advanceTimersByTimeAsync(1000)
    expect(passed).toEqual([0, 1, 2, 3, 4])
  })

  // Garde-fou du plafond mesuré sur api.jikan.moe : 30 succès en 28 s, soit une
  // rafale de ~3 puis ~1 jeton/s. 200 demandes ne doivent pas en servir plus de 63
  // sur la première minute. Prouvé par mutation (cf. spec du 2026-08-25).
  it('ne sert que la rafale plus un jeton par seconde sur une minute', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ capacity: 3, refillPerSecond: 1 })

    let passed = 0
    for (let i = 0; i < 200; i += 1) {
      limiter.acquire().then(() => { passed += 1 })
    }

    await vi.advanceTimersByTimeAsync(0)
    expect(passed).toBe(3)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(passed).toBe(63)
  })

  // Une horloge peut reculer (ajustement NTP, changement d'heure système). Si le
  // seau interprétait ce recul comme « aucun temps écoulé », il resterait bloqué
  // jusqu'à ce que l'heure réelle rattrape son retard.
  it('ne se bloque pas quand l’horloge recule', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00Z'))
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 1 })

    await limiter.acquire()

    vi.setSystemTime(new Date('2026-08-25T11:59:00Z'))

    const pending = limiter.acquire()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toBeUndefined()
  })

  it('rejette une attente annulée sans lui faire consommer de jeton', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ capacity: 1, refillPerSecond: 1 })
    const controller = new AbortController()

    const first = limiter.acquire()
    const cancelled = limiter.acquire(controller.signal)
    const third = limiter.acquire()

    await vi.advanceTimersByTimeAsync(0)
    await expect(first).resolves.toBeUndefined()

    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })

    // Le jeton rechargé à t+1s revient au troisième et non à l'attente annulée.
    await vi.advanceTimersByTimeAsync(1000)
    await expect(third).resolves.toBeUndefined()
  })
})
