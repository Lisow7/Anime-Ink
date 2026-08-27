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

  // Le mécanisme lui-même, sur des valeurs d'exemple : une rafale de 3 puis un
  // jeton par seconde laisse passer 63 demandes en une minute, jamais 200. La
  // configuration réellement en service vit dans l'adaptateur, et fait l'objet
  // du cas suivant.
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

  /**
   * Le réglage en service, confronté au plafond annoncé par l'API.
   *
   * AniList applique 30 requêtes par minute — mesuré, sa documentation en
   * annonce 90 et assume la réduction. Le réglage de l'adaptateur (rafale de 5,
   * un jeton toutes les deux secondes) doit tenir sous ce plafond : le dépasser
   * ne dégrade pas le service, il le fait refuser.
   *
   * Ce cas relie donc un mécanisme générique à une contrainte réelle. Si le
   * réglage de l'adaptateur change, c'est ici qu'on doit s'en apercevoir.
   */
  it('tient sous les trente requêtes par minute de l’API', async () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ capacity: 5, refillPerSecond: 0.5 })

    let passed = 0
    for (let i = 0; i < 200; i += 1) {
      limiter.acquire().then(() => { passed += 1 })
    }

    await vi.advanceTimersByTimeAsync(0)
    expect(passed).toBe(5)

    await vi.advanceTimersByTimeAsync(60_000)
    // La rafale initiale plus un jeton toutes les deux secondes : 5 + 30 = 35
    // sur la toute première minute, puis 30 par minute en régime établi.
    expect(passed).toBe(35)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(passed).toBe(65)
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
