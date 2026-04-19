import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const formRef = useRef(null)

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

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors hover:text-[#22c55e] ${
        pathname === to ? 'text-[#22c55e]' : 'text-[#6b7280]'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 bg-[#0f0f0f]/90 backdrop-blur border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        <Link to="/" className="text-[#f5f5f5] font-bold text-xl tracking-tight shrink-0">
          Anime-<span className="text-[#22c55e]">Ink</span>
        </Link>

        <div className="flex items-center gap-8">
          {navLink('/catalogue', 'Catalogue')}

          {/* Loupe + barre de recherche dépliable (masquée sur l'accueil) */}
          {pathname !== '/' && <form ref={formRef} onSubmit={handleSearch} className="flex items-center gap-2">
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'w-52' : 'w-0'}`}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-[#1a1a1a] border border-white/10 text-[#f5f5f5] placeholder-[#6b7280] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
              />
            </div>
            <button
              type={open && query.trim() ? 'submit' : 'button'}
              onClick={() => { if (!open) setOpen(true) }}
              className="text-[#6b7280] hover:text-[#22c55e] transition-colors shrink-0"
              aria-label="Rechercher"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
            </button>
          </form>}
        </div>

      </div>
    </nav>
  )
}
