import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerAdaptateurAniList } from '../anilist'
import { estPageValide } from '../contrat-anime'

/**
 * Le catalogue d'un studio.
 *
 * Ce qui se joue ici est une **traduction de forme** : la source livre les
 * œuvres d'un studio autrement que le catalogue — pagination imbriquée,
 * enveloppe supplémentaire — et l'écran doit pourtant les afficher sans rien
 * savoir de la différence.
 */

const passeTout = { acquire: () => Promise.resolve() }

const MEDIA = {
  idMal: 28851,
  title: { romaji: 'Koe no Katachi' },
  coverImage: { large: 'https://s4.anilist.co/x.png' },
  averageScore: 89,
  format: 'MOVIE',
  status: 'FINISHED',
  genres: ['Drama'],
  isAdult: false,
}

function reponse(studios) {
  return new Response(JSON.stringify({ data: { Page: { studios } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('catalogue d’un studio', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('rend la même forme que le catalogue', async () => {
    fetch.mockImplementation(async () => reponse([{
      id: 2, name: 'Kyoto Animation',
      media: { pageInfo: { currentPage: 1, lastPage: 83, hasNextPage: true, total: 500 }, nodes: [MEDIA] },
    }]))

    const page = await creerAdaptateurAniList({ limiter: passeTout }).getAnimeByStudio('Kyoto Animation')

    // L'écran du catalogue l'affiche sans savoir d'où ça vient : la pagination
    // imbriquée de la source est ramenée à celle qu'il attend.
    expect(estPageValide(page)).toBe(true)
    expect(page.pagination.last_visible_page).toBe(83)
    expect(page.data[0].title).toBe('Koe no Katachi')
    expect(page.studio).toBe('Kyoto Animation')
  })

  it('rend une page vide pour un studio introuvable', async () => {
    fetch.mockImplementation(async () => reponse([]))

    const page = await creerAdaptateurAniList({ limiter: passeTout }).getAnimeByStudio('Studio Inexistant')

    // Une saisie approximative est un cas courant, pas une panne : l'écran doit
    // pouvoir dire « rien trouvé » plutôt que « une erreur est survenue ».
    expect(estPageValide(page)).toBe(true)
    expect(page.data).toEqual([])
  })

  it('ne demande rien pour une saisie trop courte', async () => {
    const { getAnimeByStudio } = creerAdaptateurAniList({ limiter: passeTout })

    // Une lettre isolée rendrait n'importe quoi et coûterait une requête sur
    // trente : on attend d'avoir de quoi chercher.
    expect((await getAnimeByStudio('K')).data).toEqual([])
    expect((await getAnimeByStudio('  ')).data).toEqual([])
    expect((await getAnimeByStudio()).data).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('transmet la page demandée', async () => {
    fetch.mockImplementation(async () => reponse([{ id: 2, name: 'X', media: { pageInfo: {}, nodes: [] } }]))

    await creerAdaptateurAniList({ limiter: passeTout }).getAnimeByStudio('Bones', 3)

    expect(JSON.parse(fetch.mock.calls[0][1].body).variables).toMatchObject({ nom: 'Bones', page: 3 })
  })

  it('écarte les œuvres que MyAnimeList ne référence pas', async () => {
    fetch.mockImplementation(async () => reponse([{
      id: 2, name: 'X',
      media: { pageInfo: {}, nodes: [MEDIA, { ...MEDIA, idMal: null }] },
    }]))

    const page = await creerAdaptateurAniList({ limiter: passeTout }).getAnimeByStudio('Bones')

    // Sans identifiant, une fiche ne peut ni être mise en favori ni retrouvée.
    expect(page.data).toHaveLength(1)
  })
})
