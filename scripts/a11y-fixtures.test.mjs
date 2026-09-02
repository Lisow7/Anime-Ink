import { afterEach, describe, expect, it, vi } from 'vitest'
import { repondreAniList } from './a11y-fixtures.mjs'
import { grouperParJour, JOURS_AFFICHES } from '../src/utils/semaine.js'
import { joursDEcart } from '../src/utils/dates.js'

/**
 * Le jeu d'essai vieillit-il ? La question n'avait jamais été posée.
 *
 * ## Ce qui s'est passé
 *
 * La prochaine diffusion du jeu d'essai était figée au 30 août 2026. La vue
 * « Cette semaine » ne retient que les sept jours à venir : le 31, la section
 * s'est vidée, et quatre passes d'accessibilité sont passées au rouge sur un
 * scénario dont le code n'avait pas bougé. Deux propositions de mise à jour de
 * dépendances ont porté le blâme pendant deux jours.
 *
 * ## Pourquoi une vérification ici, et pas seulement dans le navigateur
 *
 * Le garde-fou d'accessibilité voyait bien le défaut — il annonçait « témoin
 * absent » — mais il le disait après un build, une installation de Chromium et
 * quatre minutes, et il le disait mal : rien dans « témoin absent » ne désigne
 * une date périmée. Ici la question se pose en quelques millisecondes, avec sa
 * réponse dans l'énoncé.
 *
 * ## Ce qu'elle garde
 *
 * Non pas une valeur, mais une **relation** : la diffusion annoncée doit tomber
 * dans la fenêtre que la vue affiche. C'est la seule propriété dont dépendent
 * les scénarios, et la seule que le passage du temps peut rompre.
 */
describe('le jeu d’essai du calendrier', () => {
  afterEach(() => vi.useRealTimers())

  /** La série qui diffuse encore, telle que le faux réseau la rend. */
  const enDiffusion = () => repondreAniList('prochainsEpisodes', { ids: [2] })
    .data.Page.media[0]

  /** Ce que la vue retiendrait de cette série, au jour où l'on se place. */
  const retenues = serie => grouperParJour([{
    mal_id: serie.idMal,
    title: 'Sousou no Frieren',
    prochain: {
      numero: serie.nextAiringEpisode.episode,
      dateISO: new Date(serie.nextAiringEpisode.airingAt * 1000).toISOString(),
    },
  }])

  it('annonce une diffusion à venir, quel que soit le jour où l’on tourne', () => {
    // L'horloge est déplacée AVANT d'interroger le faux réseau : c'est
    // précisément ce qu'une intégration fait chaque jour, et ce que la version
    // figée ne supportait pas. Déplacer seulement le regard, sans redemander la
    // réponse, ne prouverait rien.
    for (const jour of ['2026-09-02', '2026-12-25', '2027-06-15', '2030-01-01']) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(`${jour}T09:00:00`))

      const serie = enDiffusion()
      expect(serie.nextAiringEpisode).not.toBeNull()
      expect(
        retenues(serie),
        `le jeu d’essai ne montre plus rien le ${jour} : sa date est figée`,
      ).toHaveLength(1)

      vi.useRealTimers()
    }
  })

  it('reste dans la fenêtre à n’importe quelle heure du jour', () => {
    // L'heure à laquelle tourne l'intégration ne doit pas décider du résultat.
    // Elle le déciderait si la diffusion était calculée « pour aujourd'hui » :
    // à 23 h 59, elle serait d'hier une minute plus tard.
    for (const heure of Array.from({ length: 24 }, (_, h) => h)) {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 8, 2, heure, 30, 0))

      const serie = enDiffusion()
      const ecart = joursDEcart(new Date(serie.nextAiringEpisode.airingAt * 1000))

      expect(ecart, `à ${heure} h, la diffusion tombe à ${ecart} jour(s) d’ici`)
        .toBeGreaterThanOrEqual(1)
      expect(ecart, `à ${heure} h, la diffusion sort de l’horizon affiché`)
        .toBeLessThan(JOURS_AFFICHES)

      vi.useRealTimers()
    }
  })
})
