import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'

const AgeFilterContext = createContext(null)

export function AgeFilterProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.preferences === true

  const [blurHentai, setBlurHentai] = useState(() => {
    if (hasConsent('preferences')) {
      return readStorage('anime-ink-age-filter', true, value => typeof value === 'boolean')
    }
    return true
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (!canStore) removeStorage('anime-ink-age-filter')
  }, [canStore])

  const toggle = () => {
    const next = !blurHentai
    setBlurHentai(next)
    if (canStore) writeStorage('anime-ink-age-filter', next)
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
