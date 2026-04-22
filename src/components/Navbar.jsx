import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { useTheme } from '../context/ThemeContext'
import { useAgeFilter } from '../context/AgeFilterContext'

export default function Navbar() {
  const { pathname, search } = useLocation()
  const { favorites } = useFavorites()
  const { theme, toggle } = useTheme()
  const { blurHentai, toggle: toggleAgeFilter } = useAgeFilter()
  const [menuOpen, setMenuOpen] = useState(false)
  const isFavorisTab = pathname === '/catalogue' && search.includes('tab=favoris')

  useEffect(() => { setMenuOpen(false) }, [pathname, search])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const ThemeIcon = () => theme === 'dark' ? (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  const LockIcon = () => (
    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current shrink-0" strokeWidth="2.5">
      {blurHentai
        ? <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round"/></>
        : <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" strokeLinecap="round" strokeDasharray="2 2"/></>
      }
    </svg>
  )

  const navLink = (to, label) => {
    const isActive = pathname === to && !isFavorisTab
    return (
      <Link
        to={to}
        className={`text-sm font-medium transition-colors hover:text-[#22c55e] ${isActive ? 'text-[#22c55e]' : 'text-[var(--text-muted)]'}`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--navbar-bg)] backdrop-blur border-b border-[var(--border-subtle)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        <Link to="/" className="text-[var(--text-primary)] font-bold text-xl tracking-tight shrink-0">
          Anime-<span className="text-[var(--color-accent)]">Ink</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-5">

          {(pathname !== '/catalogue' || search.includes('tab=')) && navLink('/catalogue', 'Catalogue')}
          {navLink('/profil', 'Profil')}

          <Link
            to="/catalogue?tab=favoris"
            className={`relative transition-colors hover:text-[#22c55e] ${isFavorisTab ? 'text-[#22c55e]' : 'text-[var(--text-muted)]'}`}
            aria-label="Mes favoris"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {favorites.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#22c55e] text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {favorites.length > 9 ? '9+' : favorites.length}
              </span>
            )}
          </Link>

          <button
            onClick={toggleAgeFilter}
            title={blurHentai ? 'Désactiver la censure' : 'Activer la censure'}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all duration-200 ${
              blurHentai
                ? 'border-[#e63946] text-[#e63946] bg-[#e63946]/10 shadow-[0_0_8px_rgba(230,57,70,0.3)]'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[#e63946]/50 hover:text-[#e63946]/60'
            }`}
          >
            <LockIcon />
            {blurHentai ? 'Censuré' : 'Non censuré'}
          </button>

          <button
            onClick={toggle}
            className="text-[var(--text-muted)] hover:text-[#22c55e] transition-colors shrink-0"
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            <ThemeIcon />
          </button>
        </div>

        {/* Mobile : thème + hamburger */}
        <div className="lg:hidden flex items-center gap-3">
          <button
            onClick={toggle}
            className="text-[var(--text-muted)] hover:text-[#22c55e] transition-colors"
            aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            <ThemeIcon />
          </button>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="text-[var(--text-muted)] hover:text-[#22c55e] transition-colors"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {menuOpen ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-current" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div className="lg:hidden border-t border-[var(--border-subtle)] bg-[var(--navbar-bg)] px-4 py-4 flex flex-col gap-3">

          {/* Liens de navigation */}
          <div className="flex flex-col gap-0.5">
            {[
              ...(pathname !== '/catalogue' || search.includes('tab=') ? [{ to: '/catalogue', label: 'Catalogue' }] : []),
              { to: '/profil', label: 'Profil' },
            ].map(({ to, label }) => {
              const isActive = pathname === to && !isFavorisTab
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'text-[#22c55e] bg-[#22c55e]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
            <Link
              to="/catalogue?tab=favoris"
              onClick={() => setMenuOpen(false)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                isFavorisTab ? 'text-[#22c55e] bg-[#22c55e]/10' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
              }`}
            >
              Favoris
              {favorites.length > 0 && (
                <span className="bg-[#22c55e] text-black text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {favorites.length > 9 ? '9+' : favorites.length}
                </span>
              )}
            </Link>
          </div>

          {/* Toggle censure */}
          <button
            onClick={toggleAgeFilter}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              blurHentai
                ? 'border-[#e63946] text-[#e63946] bg-[#e63946]/10'
                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[#e63946]/50 hover:text-[#e63946]/60'
            }`}
          >
            <LockIcon />
            {blurHentai ? 'Censuré' : 'Non censuré'}
          </button>
        </div>
      )}
    </nav>
  )
}
