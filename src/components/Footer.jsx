import { useState, useEffect } from 'react'

export default function Footer() {
  const [apiStatus, setApiStatus] = useState(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('https://api.jikan.moe/v4', { signal: AbortSignal.timeout(4000) })
        setApiStatus(res.ok)
      } catch {
        setApiStatus(false)
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-3">

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            apiStatus === null ? 'bg-[var(--text-muted)] animate-pulse' :
            apiStatus ? 'bg-[#22c55e]' : 'bg-[#e63946]'
          }`} />
          <span className="text-[var(--text-muted)] text-xs">
            {apiStatus === null ? 'Vérification…' : apiStatus ? 'API disponible' : 'API indisponible'}
          </span>
        </div>

        <p className="text-[var(--text-muted)] text-xs text-center leading-relaxed">
          © {new Date().getFullYear()} Anime-Ink · Données fournies par{' '}
          <a
            href="https://jikan.moe"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#22c55e] transition-colors underline underline-offset-2"
          >
            Jikan API
          </a>
          {' '}· Source non officielle de MyAnimeList
        </p>
        <p className="text-[var(--text-muted)]/50 text-[11px]">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </footer>
  )
}
