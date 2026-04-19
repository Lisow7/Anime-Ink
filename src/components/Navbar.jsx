import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useFavorites } from '../context/FavoritesContext'
import { useTheme } from '../context/ThemeContext'

export default function Navbar() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { favorites } = useFavorites()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const formRef = useRef(null)
  const isFavorisTab = pathname === '/catalogue' && search.includes('tab=favoris')

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (open && !query.trim() && formRef.current && !formRef.current.contains(e.target)) {
        close()
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open, query])

  const close = () => { setOpen(false); setQuery('') }

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`)
      close()
    }
  }

  const navLink = (to, label) => {
    const isActive = pathname === to && !isFavorisTab
    return (
      <Link
        to={to}
        className={`text-sm font-medium transition-colors hover:text-[#22c55e] ${
          isActive ? 'text-[#22c55e]' : 'text-[var(--text-muted)]'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--navbar-bg)] backdrop-blur border-b border-[var(--border-subtle)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        <Link to="/" className="text-[var(--text-primary)] font-bold text-xl tracking-tight shrink-0">
          Anime-<span className="text-[#22c55e]">Ink</span>
        </Link>

        <div className="flex items-center gap-8">
          {navLink('/catalogue', 'Catalogue')}
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

          {pathname !== '/' && <form ref={formRef} onSubmit={handleSearch} className="flex items-center gap-2">
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'w-52' : 'w-0'}`}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
            <button
              type={open && query.trim() ? 'submit' : 'button'}
              onClick={() => { if (!open) setOpen(true) }}
              className="text-[var(--text-muted)] hover:text-[#22c55e] transition-colors shrink-0"
              aria-label="Rechercher"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
            </button>
          </form>}

          {/* Toggle thème */}
          <button
            onClick={toggle}
            className="text-[var(--text-muted)] hover:text-[#22c55e] transition-colors shrink-0"
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>

      </div>
    </nav>
  )
}
