/**
 * La porte d'entrée des données, et le seul endroit qui nomme leur source.
 *
 * Les écrans importent d'ici, jamais d'un adaptateur. Ce qui ressemble à un
 * détour est ce qui a permis, en août 2026, de changer de source sans toucher à
 * un seul composant : l'API Jikan, qui servait le site depuis l'origine, ferme
 * le 1ᵉʳ octobre 2026 — annoncé par son équipe.
 *
 * Son adaptateur a été retiré une fois la bascule éprouvée. Le garder « au cas
 * où » revenait à maintenir, tester et documenter un chemin de code vers un
 * service éteint — et à faire porter à chaque lecteur la question « laquelle
 * des deux lit-on ? » pour une réponse qui ne changeait plus.
 *
 * Ce qu'il laisse derrière lui n'est pas rien : le socle réseau — cache,
 * limiteur, déduplication, secours périmé — lui survit et sert AniList sans
 * avoir été réécrit. Ce détour garde donc son sens le jour où la question se
 * reposera.
 */

export {
  getAnimeById,
  getAnimeByFilter,
  getAnimeFranchise,
  getAnimeRecommendations,
  getAnimeSeasons,
  getGenres,
  getProchainsEpisodes,
  getRandomAnime,
  getTopAnime,
  searchAnime,
  clearApiCache,
} from './anilist'

/**
 * Ce que l'interface doit citer : pied de page, mentions légales, messages de
 * panne, et le lien qui renvoie à la fiche d'origine.
 *
 * Rassemblé ici parce que ces mentions étaient éparpillées dans huit écrans, et
 * qu'une bascule les avait laissées derrière : le site a cité pendant un temps
 * une source qu'il n'interrogeait plus.
 */
export const ATTRIBUTION = {
  nom: 'AniList',
  url: 'https://anilist.co',
  couleur: '#02a9ff',
  description: 'une base de données communautaire ouverte',
  debit: '30 requêtes par minute',
}

export { ErreurApi } from './socle/client'
export { getApiHealth, subscribeApiHealth } from './sante-api'
