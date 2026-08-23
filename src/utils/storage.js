export function readStorage(key, fallback, validate = () => true) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value = JSON.parse(raw)
    return validate(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStorage(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
