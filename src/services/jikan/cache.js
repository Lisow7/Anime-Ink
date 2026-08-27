const PREFIX = 'anime-ink-cache:'

/**
 * `sessionStorage` peut être absent (rendu hors navigateur) ou lever à la
 * simple lecture de la propriété lorsque le stockage de site est bloqué.
 */
function sessionStore() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/**
 * Cache de réponses borné, à éviction LRU, doublé d'un miroir `sessionStorage`.
 *
 * Le miroir est volontairement en `sessionStorage` et non en `localStorage` :
 * ce dernier porte déjà les favoris, la watchlist et l'historique, données
 * irremplaçables partageant un quota de 5 Mo. Un cache jetable n'a pas à les
 * mettre en péril. Conséquence assumée : la persistance ne dépasse pas la
 * session d'onglet, et les durées de validité bornent la fraîcheur sans
 * promettre une conservation.
 */
/** Un jour de sursis après expiration : au-delà, mieux vaut une erreur franche. */
const GRACE_PAR_DEFAUT = 24 * 60 * 60 * 1000

export function createCache({ maxEntries = 200, graceMs = GRACE_PAR_DEFAUT } = {}) {
  const store = new Map()

  const perimee = entry => Date.now() >= entry.expiresAt
  const horsGrace = entry => Date.now() >= entry.expiresAt + graceMs

  function oublier(key) {
    store.delete(key)
    const storage = sessionStore()
    try { storage?.removeItem(PREFIX + key) } catch { /* stockage refusé */ }
  }

  /**
   * Rend l'entrée telle qu'elle est, expirée ou non : c'est à l'appelant de
   * décider ce qu'il en fait. Une entrée périmée était auparavant effacée ici,
   * ce qui interdisait tout secours — on jetait la seule copie disponible au
   * moment précis où elle allait servir.
   */
  function readMirror(key) {
    const storage = sessionStore()
    if (!storage) return undefined

    try {
      const raw = storage.getItem(PREFIX + key)
      if (!raw) return undefined

      const entry = JSON.parse(raw)
      if (!entry || !Number.isFinite(entry.expiresAt)) return undefined
      if (horsGrace(entry)) {
        storage.removeItem(PREFIX + key)
        return undefined
      }
      return entry
    } catch {
      return undefined
    }
  }

  function writeMirror(key, entry) {
    const storage = sessionStore()
    if (!storage) return

    // Une saturation de quota ne doit jamais remonter à l'appelant : le cache
    // dégrade silencieusement vers la mémoire seule.
    try {
      storage.setItem(PREFIX + key, JSON.stringify(entry))
    } catch {
      /* quota saturé ou écriture refusée */
    }
  }

  function remember(key, entry) {
    store.delete(key)
    store.set(key, entry)
    while (store.size > maxEntries) {
      store.delete(store.keys().next().value)
    }
  }

  return {
    get(key) {
      const entry = store.get(key) ?? readMirror(key)
      if (!entry) return undefined

      if (horsGrace(entry)) { oublier(key); return undefined }

      // L'entrée reste en réserve même périmée : `getStale` en aura besoin.
      remember(key, entry)
      return perimee(entry) ? undefined : entry.value
    },

    /**
     * La dernière réponse connue, périmée mais servie plutôt que rien.
     *
     * Réservée aux situations où le réseau a définitivement échoué : c'est le
     * `stale-if-error` de la RFC 5861, et Jikan lui-même s'en sert — ses
     * réponses portent `X-Cache-Status: STALE` pendant les pannes de
     * MyAnimeList. Une donnée d'hier vaut mieux qu'un écran vide.
     */
    getStale(key) {
      const entry = store.get(key) ?? readMirror(key)
      if (!entry) return undefined
      if (horsGrace(entry)) { oublier(key); return undefined }
      return entry.value
    },

    set(key, value, ttlMs) {
      const entry = { value, expiresAt: Date.now() + ttlMs }
      remember(key, entry)
      writeMirror(key, entry)
    },

    /**
     * Vide le cache, miroir compris. Les clés sont retirées une à une par
     * préfixe plutôt que via `sessionStorage.clear()` : rien n'autorise ce
     * cache à effacer ce qui ne lui appartient pas.
     */
    clear() {
      store.clear()

      const storage = sessionStore()
      if (!storage) return

      try {
        const ours = []
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index)
          if (key?.startsWith(PREFIX)) ours.push(key)
        }
        ours.forEach(key => storage.removeItem(key))
      } catch {
        /* stockage indisponible : la mémoire a déjà été vidée */
      }
    },
  }
}
