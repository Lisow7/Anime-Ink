import { CHANGELOG } from '../data/changelog'

const TYPE_STYLE = {
  feat:   { label: 'Nouveauté',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  fix:    { label: 'Correction',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  perf:   { label: 'Performance', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  ui:     { label: 'Interface',   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  deploy: { label: 'Déploiement', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
}

export default function ChangelogModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[102] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <div>
            <h2 className="text-[var(--text-primary)] font-semibold text-base">Notes de version</h2>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">Historique des mises à jour d'Anime-Ink</p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex flex-col gap-6 px-6 py-5">
          {CHANGELOG.map((entry, i) => (
            <div key={entry.version} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${i === 0 ? 'text-[#22c55e]' : 'text-[var(--text-muted)]'}`}>
                  Version {entry.version}
                </span>
                {i === 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.15)] text-[#22c55e]">
                    Actuelle
                  </span>
                )}
                <span className="text-[var(--text-muted)] text-xs ml-auto">{entry.date}</span>
              </div>

              <ul className="flex flex-col gap-2">
                {entry.changes.map((change, j) => {
                  const style = TYPE_STYLE[change.type] ?? TYPE_STYLE.feat
                  return (
                    <li key={j} className="flex items-start gap-2.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ color: style.color, background: style.bg }}
                      >
                        {style.label}
                      </span>
                      <span className="text-[var(--text-muted)] text-xs leading-relaxed">{change.label}</span>
                    </li>
                  )
                })}
              </ul>

              {i < CHANGELOG.length - 1 && (
                <div className="h-px bg-[var(--border-subtle)] mt-1" />
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
