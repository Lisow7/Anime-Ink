import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center min-h-[90vh] overflow-hidden px-4 sm:px-6 text-center">

      {/* Cercles flottants en arrière-plan */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="ink-circle" style={{ width: 420, height: 420, top: '10%', left: '5%', animationDelay: '0s' }} />
        <div className="ink-circle" style={{ width: 280, height: 280, bottom: '8%', right: '8%', animationDelay: '2s' }} />
        <div className="ink-circle" style={{ width: 160, height: 160, top: '55%', left: '60%', animationDelay: '1s' }} />
      </div>

      {/* Ligne verticale gauche */}
      <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#22c55e]/20 to-transparent hidden md:block" />
      {/* Ligne verticale droite */}
      <div className="absolute right-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#22c55e]/20 to-transparent hidden md:block" />

      {/* 404 glitch */}
      <div className="relative select-none mb-2">
        <span className="glitch text-[clamp(7rem,22vw,16rem)] font-black leading-none tracking-tighter text-[var(--text-primary)]" data-text="404">
          404
        </span>
      </div>

      {/* Trait décoratif */}
      <div className="flex items-center gap-4 mb-8 w-full max-w-xs">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#22c55e]/60" />
        <span className="text-[#22c55e] text-xs tracking-[0.3em] uppercase font-medium">Not Found</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#22c55e]/60" />
      </div>

      {/* Message */}
      <p className="text-[var(--text-muted)] text-sm max-w-xs leading-relaxed mb-10 tracking-wide">
        Cette page s'est dissoute dans l'encre.<br />
        Il ne reste plus rien ici.
      </p>

      {/* Bouton retour */}
      <Link
        to="/"
        className="group relative inline-flex items-center gap-3 px-5 sm:px-8 py-3 border border-[#22c55e]/40 rounded-full text-xs sm:text-sm text-[var(--text-primary)] tracking-wide sm:tracking-widest uppercase overflow-hidden transition-all duration-300 hover:border-[#22c55e]"
      >
        <span className="absolute inset-0 bg-[#22c55e]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        <span className="relative">← Retour à l'accueil</span>
      </Link>

    </main>
  )
}
