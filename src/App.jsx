import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import { CookieProvider } from './context/CookieContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { HistoryProvider } from './context/HistoryContext'
import { ModalProvider } from './context/ModalContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { ThemeProvider } from './context/ThemeContext'
import { AgeFilterProvider } from './context/AgeFilterContext'
import AnimeModal from './components/AnimeModal'
import CookieBanner from './components/CookieBanner'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'

const Catalogue     = lazy(() => import('./pages/Catalogue'))
const AnimeDetail   = lazy(() => import('./pages/AnimeDetail'))
const Profil        = lazy(() => import('./pages/Profil'))
const MentionsLegales = lazy(() => import('./pages/MentionsLegales'))
const NotFound      = lazy(() => import('./pages/NotFound'))

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
      <BrowserRouter basename="/Anime-Ink">
        <div className="min-h-screen flex flex-col overflow-x-hidden">
          <Navbar />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogue" element={<Catalogue />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/profil" element={<Profil />} />
              <Route path="/mentions-legales" element={<MentionsLegales />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <AnimeModal />
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
