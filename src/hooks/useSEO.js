import { useEffect } from 'react'

const DEFAULT_TITLE = "Anime-Ink — Découvre l'univers des animés"
const DEFAULT_DESC  = "Recherche, explore et découvre des milliers d'animés. Catalogue complet, favoris, suivi de progression et filtres avancés."
/* global __ORIGINE_SITE__ */
/**
 * L'origine du site, fixée à la compilation par l'hôte qui construit.
 *
 * Ni `window.location.origin`, ni une constante recopiée : la première ferait
 * qu'une préversion se déclare canonique et entre en concurrence avec le site
 * réel dans les moteurs de recherche ; la seconde mentirait le jour d'un
 * changement d'hébergement — c'est exactement ce genre de recopie qui avait
 * doublé le préfixe.
 *
 * Le repli n'est qu'un filet : la constante est toujours définie au build. Il
 * nomme malgré tout l'adresse réelle du site, car rattraper vers un hôte qui
 * ne fait plus que rediriger ne rattraperait rien.
 */
const ORIGINE = typeof __ORIGINE_SITE__ === 'string' ? __ORIGINE_SITE__ : 'https://anime-ink-blond.vercel.app'

/**
 * L'adresse canonique d'un chemin.
 *
 * `window.location.pathname` contient **déjà** le préfixe sous lequel le site
 * est servi. Le concaténer à une base qui le porte aussi le doublait :
 * `…/Anime-Ink/Anime-Ink/catalogue`, une adresse qui n'existe pas, annoncée
 * comme canonique sur toutes les pages sauf les fiches — les seules à fournir
 * la leur en dur, et donc les seules justes.
 *
 * Le préfixe se lit dans `import.meta.env.BASE_URL`, que Vite renseigne depuis
 * `base` : il suit la configuration au lieu d'être recopié.
 */
export function urlCanonique(pathname, base = import.meta.env.BASE_URL ?? '/') {
  const prefixe = base.replace(/\/$/, '')
  const dejaPrefixe = prefixe === '' || pathname === prefixe || pathname.startsWith(`${prefixe}/`)
  return `${ORIGINE}${dejaPrefixe ? pathname : `${prefixe}${pathname}`}`
}

const DEFAULT_IMAGE = urlCanonique('/og-image.svg')

export function useSEO({ title, description, canonical, ogImage, robots } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Anime-Ink` : DEFAULT_TITLE
    const desc      = description || DEFAULT_DESC
    const image     = ogImage || DEFAULT_IMAGE
    const url       = canonical || urlCanonique(window.location.pathname)
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
