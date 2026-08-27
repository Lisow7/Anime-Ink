/**
 * Seau à jetons, calqué sur le comportement mesuré de l'API interrogée :
 * une rafale courte est tolérée, puis le débit soutenu retombe au rythme
 * de réapprovisionnement. Voir la spec du 2026-08-25 pour la mesure.
 */
export function createRateLimiter({ capacity = 3, refillPerSecond = 1 } = {}) {
  const intervalMs = 1000 / refillPerSecond
  let tokens = capacity
  let lastRefill = Date.now()
  let timer = null
  const queue = []

  function refill() {
    const now = Date.now()
    const elapsed = now - lastRefill

    // Un recul de l'horloge se recale sur l'instant courant plutôt que de figer
    // le seau : sans cela, le limiteur attendrait que l'heure réelle rattrape
    // son retard avant de délivrer le moindre jeton.
    if (elapsed <= 0) {
      lastRefill = now
      return
    }

    tokens = Math.min(capacity, tokens + elapsed / intervalMs)
    lastRefill = now
  }

  function pump() {
    timer = null
    refill()

    while (queue.length > 0 && tokens >= 1) {
      tokens -= 1
      const entry = queue.shift()
      entry.cleanup?.()
      entry.resolve()
    }

    if (queue.length > 0 && timer === null) {
      timer = setTimeout(pump, Math.max(1, Math.ceil((1 - tokens) * intervalMs)))
    }
  }

  return {
    acquire(signal) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException('La requête a été annulée', 'AbortError'))
          return
        }

        const entry = { resolve }

        if (signal) {
          const onAbort = () => {
            const index = queue.indexOf(entry)
            if (index !== -1) queue.splice(index, 1)
            reject(new DOMException('La requête a été annulée', 'AbortError'))
          }
          signal.addEventListener('abort', onAbort, { once: true })
          entry.cleanup = () => signal.removeEventListener('abort', onAbort)
        }

        queue.push(entry)
        pump()
      })
    },
  }
}
