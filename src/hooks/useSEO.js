import { useEffect } from 'react'

const DEFAULT_TITLE = "Anime-Ink — Découvre l'univers des animés"
const DEFAULT_DESC  = "Recherche, explore et découvre des milliers d'animés. Catalogue complet, favoris, suivi de progression et filtres avancés."
const DEFAULT_IMAGE = 'https://anime-ink.app/og-image.svg'
const BASE_URL      = 'https://anime-ink.app'

export function useSEO({ title, description, canonical, ogImage, robots } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Anime-Ink` : DEFAULT_TITLE
    const desc      = description || DEFAULT_DESC
    const image     = ogImage || DEFAULT_IMAGE
    const url       = canonical || `${BASE_URL}${window.location.pathname}`
    const bot       = robots   || 'index, follow'

    document.title = fullTitle

    setMeta('name',     'title',               fullTitle)
    setMeta('name',     'description',         desc)
    setMeta('name',     'robots',              bot)
    setMeta('property', 'og:title',            fullTitle)
    setMeta('property', 'og:description',      desc)
    setMeta('property', 'og:url',              url)
    setMeta('property', 'og:image',            image)
    setMeta('name',     'twitter:title',       fullTitle)
    setMeta('name',     'twitter:description', desc)
    setMeta('name',     'twitter:url',         url)
    setMeta('name',     'twitter:image',       image)
    setCanonical(url)
  }, [title, description, canonical, ogImage, robots])
}

function setMeta(attr, value, content) {
  const el = document.querySelector(`meta[${attr}="${value}"]`)
  if (el) el.setAttribute('content', content)
}

function setCanonical(href) {
  const el = document.querySelector('link[rel="canonical"]')
  if (el) el.setAttribute('href', href)
}
