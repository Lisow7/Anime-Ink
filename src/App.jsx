import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import AnimeDetail from './pages/AnimeDetail'
import Profil from './pages/Profil'
import NotFound from './pages/NotFound'
import { FavoritesProvider } from './context/FavoritesContext'
import { HistoryProvider } from './context/HistoryContext'
import { ModalProvider } from './context/ModalContext'
import { WatchlistProvider } from './context/WatchlistContext'
import { ThemeProvider } from './context/ThemeContext'
import { AgeFilterProvider } from './context/AgeFilterContext'
import AnimeModal from './components/AnimeModal'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'

export default function App() {
  return (
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
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AnimeModal />
          <Footer />
          <ScrollToTop />
        </div>
      </BrowserRouter>
    </ModalProvider>
    </WatchlistProvider>
    </FavoritesProvider>
    </HistoryProvider>
    </AgeFilterProvider>
    </ThemeProvider>
  )
}
