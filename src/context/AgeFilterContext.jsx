import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'

const AgeFilterContext = createContext(null)

export function AgeFilterProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.preferences === true

  const [blurHentai, setBlurHentai] = useState(() => {
    if (hasConsent('preferences')) {
      return localStorage.getItem('anime-ink-age-filter') !== 'false'
    }
    return true
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (!canStore) localStorage.removeItem('anime-ink-age-filter')
  }, [canStore])

  const toggle = () => {
    const next = !blurHentai
    setBlurHentai(next)
    if (canStore) localStorage.setItem('anime-ink-age-filter', String(next))
  }

  return (
    <AgeFilterContext.Provider value={{ blurHentai, toggle }}>
      {children}
    </AgeFilterContext.Provider>
  )
}

export function useAgeFilter() {
  return useContext(AgeFilterContext)
}
