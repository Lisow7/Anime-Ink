export default function EmptyState({ query, onReset, emptyFavoris, emptyRecents, emptyListe }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-28 overflow-hidden text-center">

      {/* Cercles d'encre */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="ink-circle" style={{ width: 300, height: 300, top: '0%', left: '2%', animationDelay: '0s' }} />
        <div className="ink-circle" style={{ width: 180, height: 180, bottom: '0%', right: '4%', animationDelay: '1.5s' }} />
        <div className="ink-circle" style={{ width: 100, height: 100, top: '40%', right: '20%', animationDelay: '3s' }} />
      </div>

      {/* Titre glitch */}
      <div className="relative select-none mb-2">
        <span className="glitch text-[clamp(3.5rem,12vw,7rem)] font-black leading-none tracking-tighter text-[var(--text-primary)]" data-text="空">
          空
        </span>
      </div>

      {/* Séparateur */}
      <div className="flex items-center gap-4 mb-6 w-full max-w-xs">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#22c55e]/60" />
        <span className="text-[#22c55e] text-xs tracking-[0.3em] uppercase font-medium">Introuvable</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#22c55e]/60" />
      </div>

      {/* Message */}
      <p className="text-[var(--text-muted)] text-sm leading-relaxed mb-8 max-w-xs">
        {emptyFavoris
          ? <>Tu n'as encore rien marqué.<br />L'encre attend tes favoris.</>
          : emptyRecents
          ? <>Aucune page tournée pour l'instant.<br />Explore le catalogue pour laisser une trace.</>
          : emptyListe
          ? <>Ta liste est vide pour l'instant.<br />Ouvre un animé et marque-le pour le retrouver ici.</>
          : query
          ? <>«&nbsp;{query}&nbsp;» s'est dissous dans l'encre.<br />Aucune trace de cet animé.</>
          : <>Aucun animé ne correspond à ces filtres.<br />L'encre est vide ici.</>
        }
      </p>

      {/* Bouton reset */}
      <button
        onClick={onReset}
        className="group relative inline-flex items-center gap-2 px-6 py-2.5 border border-[#22c55e]/40 rounded-full text-sm text-[var(--text-primary)] tracking-widest uppercase overflow-hidden transition-all duration-300 hover:border-[#22c55e]"
      >
        <span className="absolute inset-0 bg-[#22c55e]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative">{(emptyFavoris || emptyRecents || emptyListe) ? '← Retour au catalogue' : '← Réinitialiser'}</span>
      </button>
    </div>
  )
}
