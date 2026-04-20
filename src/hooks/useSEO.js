import { useEffect } from 'react'

const DEFAULT_TITLE = "Anime-Ink — Découvre l'univers des animés"
const DEFAULT_DESC  = "Recherche, explore et découvre des milliers d'animés. Catalogue complet, favoris, suivi de progression et filtres avancés."

export function useSEO({ title, description } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Anime-Ink` : DEFAULT_TITLE
    const desc      = description || DEFAULT_DESC

    document.title = fullTitle

    setMeta('name',     'description',       desc)
    setMeta('property', 'og:title',          fullTitle)
    setMeta('property', 'og:description',    desc)
    setMeta('property', 'twitter:title',     fullTitle)
    setMeta('property', 'twitter:description', desc)
  }, [title, description])
}

function setMeta(attr, value, content) {
  let el = document.querySelector(`meta[${attr}="${value}"]`)
  if (el) el.setAttribute('content', content)
}
