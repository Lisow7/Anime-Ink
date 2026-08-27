import { describe, expect, it, vi } from 'vitest'
import { parcourirFranchise } from './franchise'

/**
 * Le parcours d'une franchise, sur un graphe relevé le 27 août 2026 sur
 * `graphql.anilist.co` — la chaîne de « Shingeki no Kyojin », choisie parce
 * qu'elle réunit les trois pièges d'un coup : une antériorité qui n'est pas une
 * saison, une adaptation vers un manga, et une série étrangère reliée par un
 * simple personnage partagé.
 */

const noeud = (idMal, format, extra = {}) => ({
  type: 'ANIME', idMal, format, episodes: 12, seasonYear: 2017,
  title: { romaji: `Titre ${idMal}`, english: null }, ...extra,
})

const lien = (relationType, node) => ({ relationType, node })

const GRAPHE = {
  16498: {
    ...noeud(16498, 'TV', { episodes: 25, seasonYear: 2013, title: { romaji: 'Shingeki no Kyojin' } }),
    relations: { edges: [
      lien('SEQUEL', noeud(25777, 'TV')),
      // L'antériorité de la saison 1 est un OVA : la prendre pour racine
      // ferait commencer le sélecteur de saisons sur un hors-série.
      lien('PREQUEL', noeud(25781, 'OVA', { title: { romaji: 'Kuinaki Sentaku' } })),
      lien('SIDE_STORY', noeud(18397, 'OVA', { title: { romaji: 'Shingeki no Kyojin: LOST GIRLS' } })),
      lien('ADAPTATION', { type: 'MANGA', idMal: 23390, format: 'MANGA', title: { romaji: 'Manga' } }),
      lien('CHARACTER', noeud(43413, 'ONA', { title: { romaji: 'Chiyuki no Fashion Check' } })),
    ] },
  },
  25777: {
    ...noeud(25777, 'TV', { title: { romaji: 'Shingeki no Kyojin Season 2' } }),
    relations: { edges: [
      lien('PREQUEL', noeud(16498, 'TV')),
      lien('SEQUEL', noeud(35760, 'TV')),
      lien('SUMMARY', noeud(36702, 'MOVIE', { title: { romaji: 'Shingeki no Kyojin: Chronicle' } })),
    ] },
  },
  35760: {
    ...noeud(35760, 'TV', { title: { romaji: 'Shingeki no Kyojin Season 3' } }),
    relations: { edges: [lien('PREQUEL', noeud(25777, 'TV'))] },
  },
  // L'OVA relié en PREQUEL à la saison 1 est présent dans le graphe, et
  // joignable : sans cela, un parcours qui aurait tort de le suivre s'y
  // casserait le nez et le test passerait sans rien prouver.
  25781: {
    ...noeud(25781, 'OVA', { episodes: 2, title: { romaji: 'Kuinaki Sentaku' } }),
    relations: { edges: [lien('SEQUEL', noeud(16498, 'TV'))] },
  },
}

/** Rend le média demandé, en comptant les appels — le coût fait partie du contrat. */
function fausseSource(graphe = GRAPHE) {
  const demandes = []
  const demander = vi.fn(async (id) => { demandes.push(id); return graphe[id] ?? null })
  return { demander, demandes }
}

describe('parcours d’une franchise AniList', () => {
  it('remonte jusqu’à la première saison depuis n’importe quel épisode de la chaîne', async () => {
    const { demander } = fausseSource()

    // L'utilisateur ouvre la saison 2 : un sélecteur qui démarrerait là
    // masquerait la saison 1.
    const { saisons } = await parcourirFranchise(25777, demander)

    expect(saisons.map(s => s.mal_id)).toEqual([16498, 25777, 35760])
  })

  it('ne prend pas une antériorité non télévisée pour la première saison', async () => {
    const { saisons, autres } = await parcourirFranchise(16498, fausseSource().demander)

    // 25781 est un OVA relié en PREQUEL. Il appartient à la franchise, pas à la
    // suite des saisons : sa place est parmi les à-côtés. Un parcours qui le
    // prendrait pour racine l'en ferait disparaître — c'est ce que vérifie la
    // seconde attente, la première seule étant satisfaite dans les deux cas.
    expect(saisons.map(s => s.mal_id)).not.toContain(25781)
    expect(autres.map(a => a.mal_id)).toContain(25781)
  })

  it('range films, OVA et spéciaux à part, avec un libellé lisible', async () => {
    const { autres } = await parcourirFranchise(16498, fausseSource().demander)
    const parId = Object.fromEntries(autres.map(a => [a.mal_id, a]))

    expect(parId[18397]).toMatchObject({ type: 'OVA', label: 'LOST GIRLS' })
    expect(parId[36702]).toMatchObject({ type: 'Movie', label: 'Chronicle' })
  })

  it('écarte ce qui n’appartient pas à la franchise', async () => {
    const { saisons, autres } = await parcourirFranchise(16498, fausseSource().demander)
    const tous = [...saisons, ...autres].map(x => x.mal_id)

    // Un manga n'a rien à faire dans un sélecteur de saisons…
    expect(tous).not.toContain(23390)
    // …et deux séries qui partagent un personnage ne forment pas une franchise.
    expect(tous).not.toContain(43413)
  })

  it('ne demande que les titres télévisés', async () => {
    const { demander, demandes } = fausseSource()

    await parcourirFranchise(16498, demander)

    // Chaque nœud porte déjà son format et ses épisodes : seuls les titres
    // susceptibles de prolonger la chaîne valent un appel. L'API historique
    // devait charger chaque relation pour découvrir son type — sur un budget
    // de trente requêtes par minute, la différence se voit à l'écran.
    expect(demandes.sort()).toEqual([16498, 25777, 35760])
  })

  it('s’arrête proprement quand la source ne répond pas', async () => {
    const { saisons, autres } = await parcourirFranchise(16498, async () => null)

    // Une franchise injoignable efface le sélecteur ; elle ne doit pas
    // empêcher la fiche de s'afficher.
    expect(saisons).toEqual([])
    expect(autres).toEqual([])
  })

  it('borne la descente d’une série interminable', async () => {
    const infini = {}
    for (let i = 1; i <= 40; i += 1) {
      infini[i] = { ...noeud(i, 'TV'), relations: { edges: [lien('SEQUEL', noeud(i + 1, 'TV'))] } }
    }
    const { demander } = fausseSource(infini)

    const { saisons } = await parcourirFranchise(1, demander)

    // Le sélecteur montre les six premières saisons ; charger les quarante
    // laisserait l'utilisateur devant une fiche vide le temps du parcours.
    expect(saisons.length).toBe(6)
  })

  it('borne la remontée d’une chaîne d’antériorités sans début', async () => {
    // La descente est bornée par le nombre de saisons ; la remontée, elle, ne
    // l'est que par le plafond d'appels. Sans lui, une chaîne d'antériorités
    // circulaire — ou simplement très longue — épuiserait le quota.
    const infini = {}
    for (let i = 1; i <= 40; i += 1) {
      infini[i] = { ...noeud(i, 'TV'), relations: { edges: [lien('PREQUEL', noeud(i + 1, 'TV'))] } }
    }
    const { demander, demandes } = fausseSource(infini)

    await parcourirFranchise(1, demander)

    expect(demandes.length).toBeLessThanOrEqual(12)
  })
})
