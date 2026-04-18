import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Catalogue from './pages/Catalogue'
import AnimeDetail from './pages/AnimeDetail'
import NotFound from './pages/NotFound'
import { FavoritesProvider } from './context/FavoritesContext'
import { HistoryProvider } from './context/HistoryContext'
import { ModalProvider } from './context/ModalContext'
import AnimeModal from './components/AnimeModal'

export default function App() {
  return (
    <HistoryProvider>
    <FavoritesProvider>
    <ModalProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/catalogue" element={<Catalogue />} />
            <Route path="/anime/:id" element={<AnimeDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <AnimeModal />
        </div>
      </BrowserRouter>
    </ModalProvider>
    </FavoritesProvider>
    </HistoryProvider>
  )
}
