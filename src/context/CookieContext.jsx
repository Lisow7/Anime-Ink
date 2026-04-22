import { createContext, useContext, useState, useCallback } from 'react'

const CONSENT_KEY = 'anime-ink-cookie-consent'

export function getCookieConsent() {
  try { return JSON.parse(localStorage.getItem(CONSENT_KEY)) || null }
  catch { return null }
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
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next))
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
