import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import AnimeDetail from './pages/AnimeDetail'
import Profil from './pages/Profil'
import MentionsLegales from './pages/MentionsLegales'
import NotFound from './pages/NotFound'
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

export default function App() {
  return (
    <CookieProvider>
    <ThemeProvider>
    <AgeFilterProvider>
    <HistoryProvider>
    <FavoritesProvider>
    <WatchlistProvider>
    <ModalProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col overflow-x-hidden">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/anime/:id" element={<AnimeDetail />} />
            <Route path="/profil" element={<Profil />} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
