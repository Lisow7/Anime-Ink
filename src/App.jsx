import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import { CookieProvider } from './context/CookieContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { HistoryProvider } from './context/HistoryContext'
import { ModalProvider, useModal } from './context/ModalContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { ThemeProvider } from './context/ThemeContext'
import { AgeFilterProvider } from './context/AgeFilterContext'
import CookieBanner from './components/CookieBanner'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'

const Catalogue     = lazy(() => import('./pages/Catalogue'))
const AnimeDetail   = lazy(() => import('./pages/AnimeDetail'))
const Profil        = lazy(() => import('./pages/Profil'))
const Comparer      = lazy(() => import('./pages/Comparer'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const NotFound      = lazy(() => import('./pages/NotFound'))

// AnimeModal était monté sur toutes les routes alors qu'il ne rend rien tant
// qu'aucune fiche n'est ouverte : ses 450 lignes pesaient sur le chemin
// critique de chaque page. Chargé à la demande, il est amorcé dès que le
// navigateur est au repos — donc prêt avant le premier clic, sans retarder
// l'affichage initial.
const AnimeModal = lazy(() => import('./components/AnimeModal'))

function ModaleAnimeALaDemande() {
  const { animeId } = useModal()

  useEffect(() => {
    const amorcer = () => { import('./components/AnimeModal') }
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(amorcer)
      return () => cancelIdleCallback(id)
    }
    const t = setTimeout(amorcer, 1500)
    return () => clearTimeout(t)
  }, [])

  if (!animeId) return null
  return (
    <Suspense fallback={null}>
      <AnimeModal />
    </Suspense>
  )
}

const PageFallback = () => (
  <div className="flex-1 flex items-center justify-center min-h-[40vh]">
    <div className="w-6 h-6 border-2 border-[#22c55e] border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <CookieProvider>
    <ThemeProvider>
    <AgeFilterProvider>
    <HistoryProvider>
    <FavoritesProvider>
    <WatchlistProvider>
    <ModalProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="min-h-screen flex flex-col overflow-x-hidden">
          {/* La barre de navigation précède le contenu sur toutes les pages et
              compte six à huit contrôles tabulables. Sans ce lien, un utilisateur
              au clavier les retraverse à chaque page (WCAG 2.4.1). Visible au
              focus seulement. Le conteneur reçoit l'ancre plutôt que chaque
              <main>, qui existe en neuf exemplaires. */}
          <a
            href="#contenu"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--bg-surface)] focus:text-[var(--text-primary)] focus:ring-2 focus:ring-[#22c55e]"
          >
            Aller au contenu
          </a>
          <Navbar />
          <div id="contenu" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogue" element={<Catalogue />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/profil" element={<Profil />} />
              <Route path="/comparer" element={<Comparer />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </div>
          <ModaleAnimeALaDemande />
          <Footer />
          <CookieBanner />
          <ScrollToTop />
        </div>
      </BrowserRouter>
    </ModalProvider>
    </WatchlistProvider>
    </FavoritesProvider>
    </HistoryProvider>
    </AgeFilterProvider>
    </ThemeProvider>
    </CookieProvider>
  )
}
