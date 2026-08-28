import { describe, expect, it } from 'vitest'
import { decenniesPreferees, genresPreferes } from './gouts'

const anime = (mal_id, genres, extra = {}) => ({
  mal_id, title: `Série ${mal_id}`, genres: genres.map(name => ({ mal_id: 0, name })), ...extra,
})

describe('genres préférés', () => {
  it('classe du plus fréquent au moins fréquent', () => {
    const favoris = [anime(1, ['Action', 'Drame']), anime(2, ['Action'])]
    const liste = [anime(3, ['Action', 'Comédie'])]

    expect(genresPreferes(favoris, liste).map(g => g.nom)).toEqual(['Action', 'Comédie', 'Drame'])
  })

  it('ne compte pas deux fois un titre présent dans les deux listes', () => {
    const meme = anime(1, ['Action'])

    // Une série mise en favori ET suivie reste une seule série.
    expect(genresPreferes([meme], [meme])[0].nombre).toBe(1)
  })

  it('départage les ex æquo dans l’ordre alphabétique', () => {
    const favoris = [anime(1, ['Zombie']), anime(2, ['Action'])]

    // Sans cet ordre, deux genres à égalité changeraient de place d'un rendu à
    // l'autre selon l'ordre d'insertion.
    expect(genresPreferes(favoris, []).map(g => g.nom)).toEqual(['Action', 'Zombie'])
  })

  it('rend une part comparable au genre le plus fréquent', () => {
    const favoris = [anime(1, ['Action']), anime(2, ['Action']), anime(3, ['Drame'])]
    const [premier, second] = genresPreferes(favoris, [])

    expect(premier.part).toBe(1)
    expect(second.part).toBe(0.5)
  })

  it('accepte des genres en simples chaînes', () => {
    // Les entrées enregistrées de longue date peuvent porter d'autres formes.
    const brut = { mal_id: 9, genres: ['Action'] }
    expect(genresPreferes([brut], [])[0]).toMatchObject({ nom: 'Action', nombre: 1 })
  })

  it('ne rend rien plutôt que de diviser par zéro', () => {
    expect(genresPreferes([], [])).toEqual([])
    expect(genresPreferes(undefined, undefined)).toEqual([])
    expect(genresPreferes([{ mal_id: 1 }], [])).toEqual([])
  })
})

describe('décennies préférées', () => {
  it('regroupe par décennie, de la plus ancienne à la plus récente', () => {
    const favoris = [
      anime(1, [], { year: 1998 }),
      anime(2, [], { year: 1995 }),
      anime(3, [], { year: 2021 }),
    ]

    expect(decenniesPreferees(favoris, []).map(d => d.decennie)).toEqual([1990, 2020])
    expect(decenniesPreferees(favoris, [])[0].nombre).toBe(2)
  })

  it('retrouve l’année sous ses différentes formes', () => {
    // Selon leur âge, les entrées enregistrées portent l'année dans un champ
    // dédié, dans une date de début, ou dans une chaîne libre.
    const parAnnee = anime(1, [], { year: 2005 })
    const parDate = anime(2, [], { aired: { from: '2005-04-03T00:00:00+00:00' } })
    const parTexte = anime(3, [], { aired: { string: 'Apr 3, 2005 to Apr 24, 2006' } })

    expect(decenniesPreferees([parAnnee, parDate, parTexte], [])).toEqual([
      { decennie: 2000, nombre: 3, part: 1 },
    ])
  })

  it('ignore ce qui n’a pas de date exploitable', () => {
    expect(decenniesPreferees([anime(1, [])], [])).toEqual([])
    expect(decenniesPreferees([], [])).toEqual([])
  })
})
