import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 min-h-[80vh]">
      <div className="flex flex-col gap-4 max-w-xl">
        <h1 className="text-5xl font-bold text-[#f5f5f5] tracking-tight leading-tight">
          Découvre l'univers<br />
          <span className="text-[#22c55e]">des animés</span>
        </h1>
        <p className="text-[#6b7280] text-lg">
          Recherche, explore et découvre des milliers d'animés.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-lg flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un animé..."
          className="flex-1 bg-[#1a1a1a] border border-white/10 text-[#f5f5f5] placeholder-[#6b7280] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
        />
        <button
          type="submit"
          className="bg-[#22c55e] hover:bg-[#22c55e]/80 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
        >
          Chercher
        </button>
      </form>

      <a
        href="/catalogue"
        className="text-[#6b7280] text-sm hover:text-[#22c55e] transition-colors underline underline-offset-4"
      >
        Voir tout le catalogue →
      </a>
    </main>
  )
}
