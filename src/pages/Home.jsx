import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { getTopAnime } from '../services/jikan'

export default function Home() {
  const [query, setQuery] = useState('')
  const [topAnimes, setTopAnimes] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getTopAnime(1).then((data) => {
      setTopAnimes(data.data?.slice(0, 6) ?? [])
      setLoading(false)
    })
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <main className="flex flex-col items-center px-6 py-16 gap-16 max-w-6xl mx-auto w-full">

      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-8 max-w-xl w-full">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold text-[#f5f5f5] tracking-tight leading-tight">
            Découvre l'univers<br />
            <span className="text-[#22c55e]">des animés</span>
          </h1>
          <p className="text-[#6b7280] text-lg">
            Recherche, explore et découvre des milliers d'animés.
          </p>
        </div>

        <form onSubmit={handleSearch} className="w-full flex gap-2">
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
      </section>

      {/* Top animés */}
      <section className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#f5f5f5]">Top animés du moment</h2>
          <a
            href="/catalogue"
            className="text-[#6b7280] text-sm hover:text-[#22c55e] transition-colors"
          >
            Voir tout →
          </a>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#1a1a1a] rounded-xl aspect-[2/3] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {topAnimes.map((anime) => (
              <AnimeCard key={anime.mal_id} anime={anime} />
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
