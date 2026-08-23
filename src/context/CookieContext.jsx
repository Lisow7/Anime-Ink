import { createContext, useContext, useState, useCallback } from 'react'
import { readStorage, writeStorage } from '../utils/storage'

const CONSENT_KEY = 'anime-ink-cookie-consent'

export function getCookieConsent() {
  return readStorage(CONSENT_KEY, null, value =>
    value && typeof value === 'object' &&
    typeof value.preferences === 'boolean' && typeof value.userdata === 'boolean'
  )
}

export function hasConsent(category) {
  const c = getCookieConsent()
  if (!c) return false
  return c[category] === true
}

const CookieContext = createContext(null)

export function CookieProvider({ children }) {
  const [consent, setConsent] = useState(getCookieConsent)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const saveConsent = useCallback((choices) => {
    const next = { ...choices, decidedAt: Date.now() }
    writeStorage(CONSENT_KEY, next)
    setConsent(next)
    setSettingsOpen(false)
  }, [])

  const acceptAll  = useCallback(() => saveConsent({ preferences: true,  userdata: true  }), [saveConsent])
  const refuseAll  = useCallback(() => saveConsent({ preferences: false, userdata: false }), [saveConsent])
  const openSettings  = useCallback(() => setSettingsOpen(true),  [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  return (
    <CookieContext.Provider value={{ consent, acceptAll, refuseAll, saveConsent, openSettings, closeSettings, settingsOpen }}>
      {children}
    </CookieContext.Provider>
  )
}

export function useCookieConsent() {
  return useContext(CookieContext)
}
