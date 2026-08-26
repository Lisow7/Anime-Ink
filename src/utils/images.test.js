import { describe, expect, it } from 'vitest'
import { posterUrl } from './images'

const images = {
  jpg: { image_url: 'https://cdn/1.jpg', large_image_url: 'https://cdn/1l.jpg' },
  webp: { image_url: 'https://cdn/1.webp', large_image_url: 'https://cdn/1l.webp' },
}

describe('choix de la jaquette', () => {
  it('préfère le WebP', () => {
    expect(posterUrl(images)).toBe('https://cdn/1.webp')
  })

  it('sert la grande variante à la demande', () => {
    expect(posterUrl(images, { large: true })).toBe('https://cdn/1l.webp')
  })

  it('retombe sur le JPG quand le WebP manque', () => {
    expect(posterUrl({ jpg: images.jpg })).toBe('https://cdn/1.jpg')
    expect(posterUrl({ jpg: images.jpg }, { large: true })).toBe('https://cdn/1l.jpg')
  })

  it('retombe sur l’autre taille plutôt que de ne rien rendre', () => {
    expect(posterUrl({ webp: { large_image_url: 'https://cdn/1l.webp' } }))
      .toBe('https://cdn/1l.webp')
  })

  it('ne rend rien quand il n’y a aucune image', () => {
    expect(posterUrl(undefined)).toBeUndefined()
    expect(posterUrl({})).toBeUndefined()
  })
})
