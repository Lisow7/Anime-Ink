import { createContext, useContext, useState } from 'react'

const AgeFilterContext = createContext(null)

export function AgeFilterProvider({ children }) {
  const [blurHentai, setBlurHentai] = useState(() =>
    localStorage.getItem('anime-ink-age-filter') !== 'false'
  )

  const toggle = () => {
    const next = !blurHentai
    setBlurHentai(next)
    localStorage.setItem('anime-ink-age-filter', String(next))
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
