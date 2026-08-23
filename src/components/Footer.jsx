import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useCookieConsent } from '../context/CookieContext'
import ChangelogModal from './ChangelogModal'
import { CURRENT_VERSION } from '../data/changelog'
import { getApiHealth, subscribeApiHealth } from '../services/jikan'

export default function Footer() {
  const apiHealth = useSyncExternalStore(subscribeApiHealth, getApiHealth, getApiHealth)
  const [showChangelog, setShowChangelog] = useState(false)
  const { openSettings } = useCookieConsent()

  const statusLabel = {
    unknown: 'En attente de données…',
    available: 'API disponible',
    degraded: 'API ralentie',
    unavailable: 'API indisponible',
  }[apiHealth.status]

  return (
    <>
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center gap-3">

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            apiHealth.status === 'unknown' ? 'bg-[var(--text-muted)] animate-pulse' :
            apiHealth.status === 'available' ? 'bg-[#22c55e]' :
            apiHealth.status === 'degraded' ? 'bg-[#f59e0b]' : 'bg-[#e63946]'
          }`} />
          <span className="text-[var(--text-muted)] text-xs" role="status" aria-live="polite">
            {statusLabel}
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

        <button
          onClick={() => setShowChangelog(true)}
          className="text-[var(--text-muted)] text-[11px] hover:text-[var(--color-accent)] transition-colors"
        >
          Version {CURRENT_VERSION} · Voir les nouveautés
        </button>

        <div className="flex items-center gap-4">
          <Link
            to="/mentions-legales"
            className="text-[var(--text-muted)] text-[11px] hover:text-[var(--color-accent)] transition-colors underline underline-offset-2"
          >
            Mentions légales
          </Link>
          <span className="text-[var(--text-muted)] text-[11px]">·</span>
          <button
            onClick={openSettings}
            className="text-[var(--text-muted)] text-[11px] hover:text-[var(--color-accent)] transition-colors underline underline-offset-2"
          >
            Gérer les cookies
          </button>
        </div>

      </div>
    </footer>

    {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
  </>
  )
}
