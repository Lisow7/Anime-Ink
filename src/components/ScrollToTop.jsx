import { useState, useEffect } from 'react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Anneau ping */}
      <span className="absolute inset-0 rounded-full bg-[#22c55e] opacity-30 animate-ping" />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="relative bg-[#22c55e] hover:bg-[#22c55e]/80 text-black rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 shadow-lg group"
        aria-label="Retour en haut"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 fill-none stroke-current transition-transform duration-200 group-hover:-translate-y-0.5"
          strokeWidth="2.5"
        >
          <path d="M18 15l-6-6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
