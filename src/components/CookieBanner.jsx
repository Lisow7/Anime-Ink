import { useState, useEffect } from 'react'
import { useCookieConsent } from '../context/CookieContext'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        checked ? 'bg-[#15803d]' : 'bg-[var(--overlay-soft)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

export default function CookieBanner() {
  const { consent, acceptAll, refuseAll, saveConsent, settingsOpen, openSettings, closeSettings } = useCookieConsent()
  const [prefs, setPrefs] = useState({ preferences: true, userdata: true })

  useEffect(() => {
    if (settingsOpen) {
      setPrefs({
        preferences: consent?.preferences ?? true,
        userdata:    consent?.userdata    ?? true,
      })
    }
  }, [settingsOpen])

  const showBanner = consent === null && !settingsOpen

  if (!showBanner && !settingsOpen) return null

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-4 animate-[slideUp_0.3s_ease-out]">
          <div className="max-w-4xl mx-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text-primary)] text-sm font-semibold mb-1">Gestion des données locales</p>
              <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                Anime-Ink utilise le <strong>stockage local</strong> (localStorage) de votre navigateur pour mémoriser vos favoris, votre liste, votre historique et vos préférences. Aucune donnée n'est envoyée à un serveur.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={refuseAll}
                className="text-xs px-3 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#e63946] hover:text-[#e63946] transition-colors"
              >
                Tout refuser
              </button>
              <button
                onClick={openSettings}
                className="text-xs px-3 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors"
              >
                Personnaliser
              </button>
              <button
                onClick={acceptAll}
                className="text-xs px-3 py-2 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white font-medium transition-colors"
              >
                Tout accepter
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeSettings() }}
        >
          <div className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6">

            <div className="flex items-center justify-between">
              <h2 className="text-[var(--text-primary)] font-semibold text-base">Préférences de cookies</h2>
              <button
                onClick={closeSettings}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-primary)] text-sm font-medium">Fonctionnement essentiel</span>
                  <span className="text-[var(--text-muted)] text-xs leading-relaxed">Enregistrement de votre choix de consentement. Toujours actif, ne peut pas être refusé.</span>
                </div>
                <Toggle checked disabled onChange={() => {}} />
              </div>

              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-primary)] text-sm font-medium">Préférences d'affichage</span>
                  <span className="text-[var(--text-muted)] text-xs leading-relaxed">Thème clair / sombre, filtre de contenu adulte (censure).</span>
                </div>
                <Toggle
                  checked={prefs.preferences}
                  onChange={(v) => setPrefs(p => ({ ...p, preferences: v }))}
                />
              </div>

              <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text-primary)] text-sm font-medium">Données personnelles</span>
                  <span className="text-[var(--text-muted)] text-xs leading-relaxed">Favoris, liste de suivi, historique de consultation récente.</span>
                </div>
                <Toggle
                  checked={prefs.userdata}
                  onChange={(v) => setPrefs(p => ({ ...p, userdata: v }))}
                />
              </div>
            </div>

            {!prefs.userdata && (
              <p className="text-[var(--text-muted)] text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2">
                Sans le stockage des données personnelles, vos favoris, liste et historique ne seront pas conservés entre les sessions.
              </p>
            )}

            <div className="flex items-center gap-3 justify-end pt-1">
              {consent !== null && (
                <button
                  onClick={closeSettings}
                  className="text-xs px-4 py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={() => saveConsent(prefs)}
                className="text-sm px-4 py-2 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white font-medium transition-colors"
              >
                Enregistrer mes choix
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
