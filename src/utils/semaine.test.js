import { describe, expect, it } from 'vitest'
import { grouperParJour, JOURS_AFFICHES } from './semaine'

const REF = new Date('2026-08-28T09:00:00')

const sortie = (mal_id, quand, numero = 1) => ({
  mal_id, title: `Série ${mal_id}`, prochain: { numero, dateISO: new Date(quand).toISOString() },
})

describe('groupement des sorties par jour', () => {
  it('réunit les diffusions d’un même soir', () => {
    const groupes = grouperParJour([
      sortie(1, '2026-08-28T22:00:00'),
      sortie(2, '2026-08-28T18:30:00'),
    ], REF)

    expect(groupes).toHaveLength(1)
    // Et les ordonne par heure : un programme se lit dans l'ordre où il passe.
    expect(groupes[0].sorties.map(s => s.mal_id)).toEqual([2, 1])
  })

  it('range les jours dans l’ordre', () => {
    const groupes = grouperParJour([
      sortie(1, '2026-08-30T12:00:00'),
      sortie(2, '2026-08-28T12:00:00'),
      sortie(3, '2026-08-29T12:00:00'),
    ], REF)

    expect(groupes.map(g => g.sorties[0].mal_id)).toEqual([2, 3, 1])
  })

  it('écarte ce qui est déjà passé', () => {
    // Une diffusion d'hier n'a plus rien à annoncer.
    expect(grouperParJour([sortie(1, '2026-08-27T20:00:00')], REF)).toEqual([])
  })

  it('écarte ce qui dépasse l’horizon', () => {
    // Au-delà d'une semaine, les sorties lointaines noieraient ce qui arrive.
    const dans8jours = sortie(1, '2026-09-05T12:00:00')
    expect(grouperParJour([dans8jours], REF)).toEqual([])

    const dans6jours = sortie(2, '2026-09-03T12:00:00')
    expect(grouperParJour([dans6jours], REF)).toHaveLength(1)
  })

  it('garde une diffusion de ce soir, même tardive', () => {
    // Le calcul porte sur les jours calendaires : à 23 h, il reste moins d'un
    // jour, mais c'est toujours aujourd'hui.
    expect(grouperParJour([sortie(1, '2026-08-28T23:30:00')], REF)).toHaveLength(1)
  })

  it('ignore ce qui n’a pas de date', () => {
    const sansDate = { mal_id: 9, title: 'Terminée', prochain: null }
    expect(grouperParJour([sansDate, sortie(1, '2026-08-29T12:00:00')], REF)).toHaveLength(1)
  })

  it('supporte une liste absente', () => {
    expect(grouperParJour(undefined, REF)).toEqual([])
    expect(grouperParJour([], REF)).toEqual([])
  })

  it('annonce son horizon', () => {
    expect(JOURS_AFFICHES).toBe(7)
  })
})
