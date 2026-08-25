import { describe, it, expect } from 'vitest'
import { ADULT_GENRES, classifyAdultContent } from './ageFilter'

/**
 * Les trois genres que MyAnimeList réunit sous « Explicit Genres », relevés sur
 * https://myanimelist.net/anime.php le 2026-08-26 et recoupés avec les
 * compteurs de `/genres/anime` (Ecchi 828, Erotica 95, Hentai 1634).
 *
 * Ce tableau est le garde-fou : « Erotica » manquait, et 95 animés
 * s'affichaient en clair malgré la censure. Une liste incomplète ne se voit pas
 * — elle se prouve.
 */
const GENRES_EXPLICITES_MAL = ['Ecchi', 'Erotica', 'Hentai']

describe('ageFilter', () => {
  it('couvre les trois genres explicites de MyAnimeList', () => {
    for (const genre of GENRES_EXPLICITES_MAL) {
      expect(ADULT_GENRES).toContain(genre)
    }
  })

  it('classe chaque genre explicite comme contenu adulte', () => {
    for (const genre of GENRES_EXPLICITES_MAL) {
      expect(classifyAdultContent([{ name: genre }]).adult).toBe(true)
    }
  })

  it('laisse passer un genre ordinaire', () => {
    expect(classifyAdultContent([{ name: 'Action' }, { name: 'Comedy' }]).adult).toBe(false)
  })

  it('distingue le palier : Erotica et Hentai en -18, Ecchi en -16', () => {
    expect(classifyAdultContent([{ name: 'Hentai' }]).badge).toBe('-18')
    expect(classifyAdultContent([{ name: 'Erotica' }]).badge).toBe('-18')
    expect(classifyAdultContent([{ name: 'Ecchi' }]).badge).toBe('-16')
  })

  it('ne décerne aucun palier à un contenu qui n’est pas adulte', () => {
    expect(classifyAdultContent([{ name: 'Action' }]).badge).toBe(null)
  })

  it('supporte une liste absente, vide ou mal formée', () => {
    for (const entree of [undefined, null, [], [null], [{}]]) {
      expect(classifyAdultContent(entree).adult).toBe(false)
    }
  })
})
