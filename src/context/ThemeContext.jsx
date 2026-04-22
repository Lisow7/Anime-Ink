import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.preferences === true

  const [theme, setTheme] = useState(() => {
    if (hasConsent('preferences')) {
      const saved = localStorage.getItem('anime-ink-theme')
      if (saved) return saved
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (!canStore) localStorage.removeItem('anime-ink-theme')
  }, [canStore])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    if (canStore) localStorage.setItem('anime-ink-theme', theme)
  }, [theme, canStore])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
