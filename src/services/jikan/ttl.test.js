import { describe, expect, it } from 'vitest'
import { ttlForPath } from './ttl'

const HEURE = 60 * 60 * 1000
const JOUR = 24 * HEURE

describe('durées de validité par ressource', () => {
  it('garde une fiche d’animé et ses recommandations une journée', () => {
    expect(ttlForPath('/anime/16498/full')).toBe(JOUR)
    expect(ttlForPath('/anime/16498/recommendations')).toBe(JOUR)
  })

  it('garde la liste des genres une semaine', () => {
    expect(ttlForPath('/genres/anime')).toBe(7 * JOUR)
  })

  it('garde une heure les classements et les recherches', () => {
    expect(ttlForPath('/top/anime?page=1&limit=24')).toBe(HEURE)
    expect(ttlForPath('/anime?q=naruto&limit=20')).toBe(HEURE)
  })

  it('ne garde jamais l’animé aléatoire', () => {
    expect(ttlForPath('/random/anime')).toBe(0)
  })

  it('ne garde pas une ressource inconnue plutôt que de deviner', () => {
    expect(ttlForPath('/producers/1')).toBe(0)
  })
})
