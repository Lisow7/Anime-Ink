import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  estAnimeAffichable,
  estGenreValide,
  estPageValide,
  estRecommandationValide,
  champsManquants,
} from './contrat-anime'
import { getApiHealth, reinitialiserSante } from './sante-api'

/**
 * La suite qu'un adaptateur doit passer pour être recevable.
 *
 * C'est ici que vit la valeur du contrat. Le décrire en prose n'engage à rien ;
 * une suite exécutable, appliquée à chaque source, oblige la seconde à rendre
 * ce que la première rendait. Sans elle, la bascule vers AniList se
 * vérifierait à l'œil, écran par écran.
 *
 * Elle ne teste **pas** le réseau, ni le cache, ni le débit : ceux-là ont leurs
 * propres tests. Elle ne regarde que la **forme de ce qui sort**.
 *
 * @param {string} nom            source décrite, pour le libellé des tests
 * @param {object} adaptateur     ses fonctions publiques
 * @param {Function} installerReseau  installe le faux réseau ; reçoit le cas à
 *   simuler (`'anime'`, `'liste'`, `'genres'`, `'recommandations'`) et répond
 *   dans le format propre à la source
 * @param {Function} [avantChaque] purge éventuelle entre deux cas — un cache de
 *   module resservirait la réponse du test précédent
 */
export function verifierContrat(nom, { adaptateur, installerReseau, avantChaque }) {
  describe(`contrat — ${nom}`, () => {
    beforeEach(() => {
      avantChaque?.()
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('rend une fiche affichable', async () => {
      installerReseau('anime')
      const anime = await adaptateur.getAnimeById(1)

      expect(
        estAnimeAffichable(anime),
        `champs manquants : ${champsManquants(anime).join(', ') || '(aucun)'}`,
      ).toBe(true)
    })

    it('rend un identifiant numérique, pas une chaîne', async () => {
      installerReseau('anime')
      const anime = await adaptateur.getAnimeById(1)

      // Les favoris comparent par `===`. Un identifiant en chaîne ferait
      // silencieusement échouer toute reconnaissance d'un titre déjà connu.
      expect(typeof anime.mal_id).toBe('number')
    })

    it('rend une note sur dix, jamais sur cent', async () => {
      installerReseau('anime')
      const { score } = await adaptateur.getAnimeById(1)

      // AniList compte sur 100. Une conversion oubliée afficherait « 86 / 10 »
      // et colorerait tous les badges au maximum.
      if (score != null) {
        expect(typeof score).toBe('number')
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(10)
      }
    })

    it('rend des genres nommés, exploitables par le filtre d’âge', async () => {
      installerReseau('anime')
      const { genres } = await adaptateur.getAnimeById(1)

      expect(Array.isArray(genres)).toBe(true)
      // Le dispositif de censure lit `name`. Des genres sans nom le rendraient
      // aveugle sans qu'aucune erreur ne se produise.
      genres.forEach(genre => expect(estGenreValide(genre)).toBe(true))
    })

    it('rend une page de résultats dont `data` est toujours un tableau', async () => {
      installerReseau('liste')
      const page = await adaptateur.getTopAnime(1)

      expect(estPageValide(page)).toBe(true)
      page.data.forEach(anime => expect(estAnimeAffichable(anime)).toBe(true))
    })

    it('rend une recherche sous forme de tableau, même vide', async () => {
      installerReseau('liste')
      const resultats = await adaptateur.searchAnime('cowboy')

      expect(Array.isArray(resultats)).toBe(true)
      resultats.forEach(anime => expect(estAnimeAffichable(anime)).toBe(true))
    })

    it('rend des genres utilisables par le menu du catalogue', async () => {
      installerReseau('genres')
      const genres = await adaptateur.getGenres()

      expect(Array.isArray(genres)).toBe(true)
      genres.forEach(genre => expect(estGenreValide(genre)).toBe(true))
    })

    it('rend des recommandations affichables', async () => {
      installerReseau('recommandations')
      const recos = await adaptateur.getAnimeRecommendations(1)

      expect(Array.isArray(recos)).toBe(true)
      recos.forEach(reco => expect(estRecommandationValide(reco)).toBe(true))
    })

    it('rend des saisons identifiées, pour la ligne de progression', async () => {
      installerReseau('anime')
      const saisons = await adaptateur.getAnimeSeasons(1, 26)

      // La liste de suivi additionne les épisodes de chaque saison. Une entrée
      // sans identifiant y ferait une ligne fantôme, et un décompte en chaîne
      // de caractères une addition silencieusement fausse.
      expect(Array.isArray(saisons)).toBe(true)
      expect(saisons.length).toBeGreaterThan(0)
      saisons.forEach(saison => {
        expect(typeof saison.mal_id).toBe('number')
        expect(saison.episodes === null || typeof saison.episodes === 'number').toBe(true)
      })
    })

    it('rend une franchise en deux listes, même vides', async () => {
      installerReseau('anime')
      const franchise = await adaptateur.getAnimeFranchise({ mal_id: 1, title: 'Cowboy Bebop' })

      // La modale lit les deux sans se protéger : le contrat promet des
      // tableaux, y compris pour une œuvre isolée.
      expect(Array.isArray(franchise.seasons)).toBe(true)
      expect(Array.isArray(franchise.others)).toBe(true)
    })

    it('alimente le voyant de santé', async () => {
      // Le pied de page ne parle pas de la source : il dit à l'utilisateur si
      // ce qu'il regarde est frais. Une source qui n'y verse rien laisse le
      // voyant sur « inconnu » à vie, sans qu'aucune erreur ne se produise —
      // c'est exactement ce qui serait arrivé après la bascule, l'état vivant
      // jusqu'ici dans le module Jikan.
      reinitialiserSante()
      expect(getApiHealth().status).toBe('unknown')

      installerReseau('anime')
      await adaptateur.getAnimeById(1)

      expect(getApiHealth().status).toBe('available')
    })

    it('ne rend jamais `undefined` là où un tableau est attendu', async () => {
      // Une source qui répond vide ne doit pas obliger chaque appelant à se
      // protéger par `?? []` — c'est au contrat de tenir cette promesse.
      installerReseau('vide')
      const [resultats, genres, recos] = await Promise.all([
        adaptateur.searchAnime('rien'),
        adaptateur.getGenres(),
        adaptateur.getAnimeRecommendations(1),
      ])

      expect(Array.isArray(resultats)).toBe(true)
      expect(Array.isArray(genres)).toBe(true)
      expect(Array.isArray(recos)).toBe(true)
    })
  })
}
