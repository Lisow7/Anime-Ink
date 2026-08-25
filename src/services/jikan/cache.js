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
export function createCache({ maxEntries = 200 } = {}) {
  const store = new Map()

  function readMirror(key) {
    const storage = sessionStore()
    if (!storage) return undefined

    try {
      const raw = storage.getItem(PREFIX + key)
      if (!raw) return undefined

      const entry = JSON.parse(raw)
      if (!entry || !Number.isFinite(entry.expiresAt)) return undefined
      if (Date.now() >= entry.expiresAt) {
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
      let entry = store.get(key)

      if (!entry) {
        entry = readMirror(key)
        if (!entry) return undefined
        remember(key, entry)
        return entry.value
      }

      if (Date.now() >= entry.expiresAt) {
        store.delete(key)
        return undefined
      }

      remember(key, entry)
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
