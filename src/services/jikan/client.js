/** Statuts que Jikan ou MyAnimeList rendent de façon passagère. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

export class JikanError extends Error {
  constructor(message, { status = null, retryAfter = null, cause } = {}) {
    super(message, { cause })
    this.name = 'JikanError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

/**
 * Attente entre deux tentatives.
 *
 * Le point de départ est à 2 s, non à 500 ms : le seau à jetons ne se
 * réapprovisionne qu'à raison d'un jeton par seconde, donc un backoff plus
 * court que la recharge ne laisse jamais le seau se reconstituer — c'est
 * précisément ce qui faisait finir les séquences de retry en 429.
 */
export function defaultRetryDelay(attempt, response) {
  const header = response?.headers?.get?.('Retry-After')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 10_000)
    const date = Date.parse(header)
    if (Number.isFinite(date)) return Math.min(Math.max(0, date - Date.now()), 10_000)
  }
  return Math.min(2000 * 2 ** attempt, 10_000) + Math.floor(Math.random() * 250)
}

function sleep(ms) {
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
}

function abortError() {
  return new DOMException('La requête a été annulée', 'AbortError')
}

/** Espace de noms des échecs mémorisés, distinct de celui des succès. */
const FAILURE_KEY = 'échec:'

export function createJikanClient({
  fetchImpl,
  limiter,
  cache,
  ttlFor,
  retries = 2,
  retryDelayFor = defaultRetryDelay,
  failureTtl = 30_000,
  /** Prévenu quand une réponse périmée a été resservie, avec sa date. */
  onStale,
}) {
  const inFlight = new Map()

  /** Sert la réserve s'il y en a une, en signalant de quand elle date. */
  function servirLaReserve(path) {
    const secours = cache.getStale?.(path)
    if (secours === undefined) return undefined
    onStale?.(cache.staleDate?.(path) ?? null)
    return secours
  }

  async function run(path, signal) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await limiter.acquire(signal)

      let response
      try {
        response = await fetchImpl(path, { signal })
      } catch (error) {
        // Une annulation appartient à l'appelant : elle ne se convertit pas et
        // ne se réessaie pas.
        if (error?.name === 'AbortError') throw error

        if (attempt < retries) {
          await sleep(retryDelayFor(attempt, null))
          continue
        }

        const secours = servirLaReserve(path)
        if (secours !== undefined) return secours

        throw error instanceof JikanError
          ? error
          : new JikanError('Impossible de joindre Jikan', { cause: error })
      }

      if (response.ok) {
        const json = await response.json()
        const ttl = ttlFor(path)
        if (ttl > 0) cache.set(path, json, ttl)
        return json
      }

      if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
        await sleep(retryDelayFor(attempt, response))
        continue
      }

      const failure = {
        status: response.status,
        message: `Jikan a répondu avec le statut ${response.status}`,
        retryAfter: response.headers?.get?.('Retry-After') ?? null,
      }

      // Une ressource non cachable — `/random/anime` — ne l'est pas davantage
      // en échec : mémoriser sa panne rendrait le bouton « autre animé » inerte
      // sans le moindre retour visuel, au pire moment.
      if (ttlFor(path) > 0) cache.set(FAILURE_KEY + path, failure, failureTtl)

      /**
       * Dernier recours : la réponse précédente, périmée mais réelle.
       *
       * Réservé aux PANNES. Un `404` est une réponse, pas une défaillance :
       * resservir une vieille copie prétendrait que la ressource existe
       * encore. Un `400` non plus — la requête est fautive, la répéter en
       * servant du passé masquerait le défaut.
       */
      if (RETRYABLE_STATUS.has(response.status)) {
        const secours = servirLaReserve(path)
        if (secours !== undefined) return secours
      }

      throw new JikanError(failure.message, {
        status: failure.status,
        retryAfter: failure.retryAfter,
      })
    }

    throw new JikanError('Impossible de joindre Jikan')
  }

  return {
    /**
     * @param {string} path
     * @param {{ bypassCache?: boolean }} [options] `bypassCache` est réservé
     *   aux actions explicites de l'utilisateur (bouton de reprise,
     *   rafraîchissement) : un cache qui ignore un clic délibéré est une
     *   régression, pas une optimisation.
     */
    request(path, { bypassCache = false, signal } = {}) {
      if (signal?.aborted) return Promise.reject(abortError())

      if (!bypassCache) {
        const cached = cache.get(path)
        if (cached !== undefined) return Promise.resolve(cached)

        const failure = cache.get(FAILURE_KEY + path)
        if (failure !== undefined) {
          return Promise.reject(new JikanError(failure.message, {
            status: failure.status,
            retryAfter: failure.retryAfter,
          }))
        }
      }

      let shared = inFlight.get(path)

      if (!shared) {
        const controller = new AbortController()
        shared = { controller, subscribers: 0, promise: null }
        shared.promise = run(path, controller.signal).finally(() => inFlight.delete(path))
        // Si tous les abonnés se désistent, plus personne ne consomme ce rejet.
        shared.promise.catch(() => {})
        inFlight.set(path, shared)
      }

      shared.subscribers += 1

      // Sans signal, l'appelant ne se désiste jamais : il suit la requête partagée.
      if (!signal) return shared.promise

      // Avec signal, son abandon lui est propre. La requête partagée n'est
      // interrompue que lorsque le dernier abonné s'est retiré — sans quoi
      // l'annulation d'une recherche obsolète dans Catalogue ferait échouer
      // les autres composants abonnés au même chemin.
      return new Promise((resolve, reject) => {
        const onAbort = () => {
          shared.subscribers -= 1
          if (shared.subscribers <= 0) shared.controller.abort()
          reject(abortError())
        }

        signal.addEventListener('abort', onAbort, { once: true })

        const detach = () => signal.removeEventListener('abort', onAbort)
        shared.promise.then(
          (value) => { detach(); resolve(value) },
          (error) => { detach(); reject(error) },
        )
      })
    },
  }
}
