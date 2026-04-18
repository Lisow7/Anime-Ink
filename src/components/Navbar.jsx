import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

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
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="text-[#f5f5f5] font-bold text-xl tracking-tight">
          Anime-<span className="text-[#22c55e]">Ink</span>
        </Link>
        <div className="flex gap-8">
          {navLink('/', 'Accueil')}
          {navLink('/catalogue', 'Catalogue')}
        </div>
      </div>
    </nav>
  )
}
