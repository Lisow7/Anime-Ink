import { describe, expect, it } from 'vitest'
import { comparer, MAX_COMPARES } from './comparaison'

const anime = (mal_id, extra = {}) => ({ mal_id, title: `Série ${mal_id}`, ...extra })
const ligne = (resultat, cle) => resultat.lignes.find(l => l.cle === cle)

describe('comparaison', () => {
  it('désigne la meilleure note', () => {
    const r = comparer([anime(1, { score: 8.7 }), anime(2, { score: 7.1 })])

    expect(ligne(r, 'note').valeurs.map(v => v.meilleur)).toEqual([true, false])
  })

  it('ne désigne personne quand deux sont à égalité', () => {
    const r = comparer([anime(1, { score: 8 }), anime(2, { score: 8 })])

    // Distinguer l'un des deux serait arbitraire, et laisserait croire à une
    // différence là où il n'y en a pas.
    expect(ligne(r, 'note').valeurs.every(v => !v.meilleur)).toBe(true)
  })

  it('ne désigne personne face à un seul animé', () => {
    const r = comparer([anime(1, { score: 9 })])

    // Un « meilleur » tout seul n'a aucun sens.
    expect(ligne(r, 'note').valeurs[0].meilleur).toBe(false)
  })

  it('met en avant la série la plus courte', () => {
    const r = comparer([anime(1, { episodes: 26 }), anime(2, { episodes: 12 })])

    // C'est ce qu'on cherche en hésitant entre deux séries avec peu de temps.
    expect(ligne(r, 'episodes').valeurs.map(v => v.meilleur)).toEqual([false, true])
  })

  it('estime le temps à regarder', () => {
    const r = comparer([anime(1, { episodes: 25 })])

    expect(ligne(r, 'duree').valeurs[0].texte).toBe('~10 h')
  })

  it('ne compare pas une donnée absente', () => {
    const r = comparer([anime(1, { score: 8 }), anime(2)])

    expect(ligne(r, 'note').valeurs[1].texte).toBe('—')
    // Une seule note connue ne fait pas d'elle la meilleure.
    expect(ligne(r, 'note').valeurs[0].meilleur).toBe(false)
  })

  it('trouve les genres communs, et eux seuls', () => {
    const r = comparer([
      anime(1, { genres: [{ name: 'Action' }, { name: 'Drame' }] }),
      anime(2, { genres: [{ name: 'Drame' }, { name: 'Comédie' }] }),
    ])

    // C'est l'apport propre d'une comparaison : ce qui rapproche, pas la simple
    // juxtaposition de deux fiches.
    expect(r.genresCommuns).toEqual(['Drame'])
  })

  it('n’annonce aucun genre commun face à un seul animé', () => {
    expect(comparer([anime(1, { genres: [{ name: 'Action' }] })]).genresCommuns).toEqual([])
  })

  it('accepte les genres en simples chaînes', () => {
    const r = comparer([anime(1, { genres: ['Action'] }), anime(2, { genres: ['Action'] })])
    expect(r.genresCommuns).toEqual(['Action'])
  })

  it('retrouve l’année sous ses différentes formes', () => {
    const r = comparer([
      anime(1, { year: 1998 }),
      anime(2, { aired: { from: '2011-04-06T00:00:00+00:00' } }),
      anime(3, { aired: { string: 'Apr 2004 to Sep 2005' } }),
    ])

    expect(ligne(r, 'annee').valeurs.map(v => v.texte)).toEqual(['1998', '2011', '2004'])
  })

  it('ne compare jamais plus que ce qui tient à l’écran', () => {
    const r = comparer(Array.from({ length: 6 }, (_, i) => anime(i + 1, { score: i })))

    expect(ligne(r, 'note').valeurs).toHaveLength(MAX_COMPARES)
  })

  it('supporte une liste vide ou abîmée', () => {
    expect(comparer([]).lignes).toEqual([])
    expect(comparer(undefined).lignes).toEqual([])
    expect(comparer([null, { pas_d_identifiant: true }]).lignes).toEqual([])
  })
})
