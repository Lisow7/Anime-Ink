import * as source from 'source-donnees'

/**
 * La source de données du site — et le seul endroit qui sache laquelle.
 *
 * Les écrans n'importent plus `services/jikan` : ils importent d'ici. Ce qui
 * paraît un détour est ce qui rend la bascule possible sans toucher à un seul
 * composant. Les deux adaptateurs passent la même suite de conformité
 * (`contrat-anime.conformite.js`) : ils rendent la même forme, seule leur
 * origine change.
 *
 * ## Pourquoi AniList
 *
 * L'API Jikan ferme le 1er octobre 2026, annoncé par son équipe. Elle reste
 * néanmoins câblée : elle a servi le site des années durant, et la garder à
 * portée d'une variable évite d'avoir à refaire ce travail si les choses
 * changent.
 *
 * ## Comment en changer
 *
 * `VITE_SOURCE_DONNEES=jikan` au build ou en développement. `source-donnees`
 * est un alias résolu par `vite.config.js` : le choix se fait à la
 * compilation, de sorte que **seule** la source retenue entre dans le bundle.
 * Importer les deux ici coûtait 1,6 ko gzip au démarrage, pour du code que
 * personne n'exécute.
 *
 * C'est aussi ce qui permet de faire tourner les parcours sur les deux
 * sources : si l'un d'eux échoue d'un côté et pas de l'autre, c'est que le
 * contrat fuit quelque part.
 */

/* global __SOURCE_DONNEES__ */
export const NOM_SOURCE = typeof __SOURCE_DONNEES__ === 'string' ? __SOURCE_DONNEES__ : 'anilist'

/** Ce que le pied de page et les mentions légales doivent citer. */
export const ATTRIBUTION = {
  anilist: { nom: 'AniList', url: 'https://anilist.co' },
  jikan: { nom: 'Jikan', url: 'https://jikan.moe' },
}[NOM_SOURCE]

export const {
  getAnimeById,
  getAnimeByFilter,
  getAnimeFranchise,
  getAnimeRecommendations,
  getAnimeSeasons,
  getGenres,
  getRandomAnime,
  getTopAnime,
  searchAnime,
  clearApiCache,
} = source

export { JikanError } from './jikan/client'
export { getApiHealth, subscribeApiHealth } from './sante-api'
