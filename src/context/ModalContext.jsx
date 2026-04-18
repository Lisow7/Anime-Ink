import { createContext, useContext, useState } from 'react'

const ModalContext = createContext(null)

export function ModalProvider({ children }) {
  const [animeId, setAnimeId] = useState(null)

  const openModal  = (id) => setAnimeId(id)
  const closeModal = ()   => setAnimeId(null)

  return (
    <ModalContext.Provider value={{ animeId, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  return useContext(ModalContext)
}
