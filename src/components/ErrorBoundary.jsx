import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-base)]">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <span className="text-5xl" aria-hidden="true">⚠️</span>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Une erreur inattendue est survenue</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Tes favoris et ta liste restent enregistrés sur cet appareil. Recharge la page pour reprendre.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white font-semibold"
          >
            Recharger la page
          </button>
        </div>
      </main>
    )
  }
}
