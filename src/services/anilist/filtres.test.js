import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { creerAdaptateurAniList } from '../anilist'

/**
 * Les filtres de saison et d'année.
 *
 * Ce qui se joue ici n'est pas l'affichage mais la **traduction** : les valeurs
 * viennent de l'URL, donc de l'extérieur, et sont transmises à une API qui
 * refuse ce qu'elle ne connaît pas. Une saison mal orthographiée ou une année
 * fantaisiste ne doit pas faire échouer la requête — elle doit être ignorée.
 */

const passeTout = { acquire: () => Promise.resolve() }

function variablesEnvoyees() {
  return JSON.parse(fetch.mock.calls[0][1].body).variables
}

describe('filtres de saison et d’année', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ data: { Page: { pageInfo: {}, media: [] } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('traduit les saisons en français vers ce qu’attend la source', async () => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ saison: 'ete', annee: 2026 })

    // L'URL porte des mots français — ce sont eux qui se partagent et se
    // mettent en signet ; la source, elle, parle en anglais et en majuscules.
    expect(variablesEnvoyees()).toMatchObject({ season: 'SUMMER', seasonYear: 2026 })
  })

  it.each([['hiver', 'WINTER'], ['printemps', 'SPRING'], ['ete', 'SUMMER'], ['automne', 'FALL']])(
    'traduit « %s »', async (fr, en) => {
      const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
      await getAnimeByFilter({ saison: fr })
      expect(variablesEnvoyees().season).toBe(en)
    },
  )

  it('ignore une saison inconnue plutôt que de la transmettre', async () => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ saison: 'mousson' })

    // La transmettre ferait refuser la requête entière : le catalogue
    // afficherait une erreur là où il devrait simplement ne pas filtrer.
    expect(variablesEnvoyees().season).toBeUndefined()
  })

  it.each([
    ['une année trop ancienne', 1800],
    ['une année trop lointaine', 2999],
    ['du texte', 'bientôt'],
    ['une décimale', 2026.5],
  ])('ignore %s', async (_cas, annee) => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ annee })

    // Ces valeurs viennent d'une adresse bricolée, pas de l'interface.
    expect(variablesEnvoyees().seasonYear).toBeUndefined()
  })

  it('accepte l’année qui vient et celle d’avant', async () => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    const prochaine = new Date().getFullYear() + 1

    await getAnimeByFilter({ annee: prochaine })
    // Les annonces de saison précèdent la diffusion : refuser l'année suivante
    // priverait le catalogue de ce qui intéresse le plus.
    expect(variablesEnvoyees().seasonYear).toBe(prochaine)
  })

  it.each([
    ['court', { dureeMax: 11 }],
    ['standard', { dureeMin: 9, dureeMax: 41 }],
    ['long', { dureeMin: 39 }],
  ])('traduit la tranche « %s » en bornes de minutes', async (tranche, attendu) => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ duree: tranche })

    // On ne cherche pas « les animés de 22 minutes » mais un format : une série
    // courte, un épisode classique, un film. L'URL porte donc la tranche, et
    // l'adaptateur la convertit en bornes.
    expect(variablesEnvoyees()).toMatchObject(attendu)
  })

  it('ignore une tranche de durée inconnue', async () => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ duree: 'interminable' })

    const envoyees = variablesEnvoyees()
    expect(envoyees.dureeMin).toBeUndefined()
    expect(envoyees.dureeMax).toBeUndefined()
  })

  it('n’impose rien quand aucun des deux n’est demandé', async () => {
    const { getAnimeByFilter } = creerAdaptateurAniList({ limiter: passeTout })
    await getAnimeByFilter({ genre: 1 })

    const envoyees = variablesEnvoyees()
    expect(envoyees.season).toBeUndefined()
    expect(envoyees.seasonYear).toBeUndefined()
  })
})
