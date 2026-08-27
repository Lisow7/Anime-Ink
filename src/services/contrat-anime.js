/**
 * Le contrat que l'application attend d'une source de données.
 *
 * Il n'existait qu'à l'état implicite, éparpillé dans les destructurations des
 * composants. L'écrire fut le préalable au changement d'API d'août 2026 : tant
 * qu'aucune forme n'est nommée, on ne peut pas vérifier qu'une nouvelle source
 * la remplit.
 *
 * Une seule source subsiste depuis. Ce module n'arbitre donc plus entre deux
 * adaptateurs, mais il garde tout son emploi : il fige ce que les écrans
 * attendent, et la suite de conformité empêche la traduction d'AniList d'y
 * déroger sans qu'on le voie — une note ramenée sur cent, un identifiant
 * devenu chaîne, un tableau devenu `undefined`.
 *
 * ## Pourquoi ces noms de champs et pas d'autres
 *
 * Ils reprennent ceux déjà en place, et c'est délibéré : les favoris, la liste
 * de suivi et l'historique **persistent ces objets dans `localStorage`**.
 * Renommer un champ rendrait illisibles des données que l'utilisateur a
 * constituées — la migration serait à écrire, à tester, et à réussir du premier
 * coup chez tout le monde. Le contrat épouse donc la forme existante, non par
 * fidélité à l'API disparue, mais parce que la rompre coûterait aux
 * utilisateurs.
 *
 * ⚠️ **Cette raison survit à la source qui l'a introduite.** `mal_id` reste
 * juste — c'est bien un identifiant MyAnimeList, celui par lequel AniList
 * retrouve une œuvre (`Media(idMal:)`). Le renommer « pour épurer » casserait
 * les favoris, la liste et l'historique de chaque visiteur.
 *
 * Ce n'est pas la forme d'une API : c'est le **sous-ensemble** que
 * l'application consomme réellement, relevé dans les destructurations de
 * `AnimeCard`, `AnimeListCard`, `AnimeModal`, `AnimeDetail`, `Home`, et dans ce
 * que les trois contextes de persistance écrivent.
 *
 * ## Ce que ce module n'est pas
 *
 * Ni un validateur de schéma, ni une couche de transformation obligatoire. Les
 * adaptateurs produisent cette forme ; ce module la **décrit** et fournit de
 * quoi la **vérifier**. Sa valeur tient dans `contrat-anime.conformite.js` :
 * une suite qu'un adaptateur doit passer pour être recevable.
 */

/**
 * Le strict nécessaire pour afficher une carte, et pour qu'une entrée persistée
 * reste utilisable. Un objet sans l'un d'eux n'est pas affichable.
 */
export const CHAMPS_REQUIS = ['mal_id', 'title', 'images']

/**
 * Ce que l'application lit ailleurs. Facultatifs au sens strict — l'interface
 * dégrade proprement quand ils manquent — mais un adaptateur qui n'en fournit
 * aucun trahirait le contrat.
 */
export const CHAMPS_ATTENDUS = [
  'title_japanese', 'title_english', 'url',
  'score', 'scored_by', 'rank', 'popularity',
  'type', 'episodes', 'duration', 'status', 'airing',
  'aired', 'season', 'year',
  'synopsis', 'genres', 'studios', 'trailer',
]

/**
 * Vrai si l'objet peut être affiché et persisté sans casser une carte.
 *
 * `images` doit porter au moins une adresse exploitable : un objet vide passait
 * les contrôles naïfs et produisait une jaquette morte.
 */
export function estAnimeAffichable(anime) {
  if (!anime || typeof anime !== 'object') return false
  if (!Number.isFinite(anime.mal_id)) return false
  if (typeof anime.title !== 'string' || anime.title.trim() === '') return false
  return Boolean(
    anime.images?.webp?.image_url
    || anime.images?.webp?.large_image_url
    || anime.images?.jpg?.image_url
    || anime.images?.jpg?.large_image_url,
  )
}

/**
 * Ce que le contrat exige d'un genre : de quoi remplir un menu et décider du
 * floutage. `name` est la clé du dispositif de censure — un genre sans nom le
 * rendrait aveugle.
 */
export function estGenreValide(genre) {
  return Boolean(
    genre
    && typeof genre === 'object'
    && Number.isFinite(genre.mal_id)
    && typeof genre.name === 'string'
    && genre.name.trim() !== '',
  )
}

/**
 * Une page de résultats. `pagination` peut manquer — une recherche n'en rend
 * pas — mais `data` doit être un tableau : les appelants s'en protègent tous
 * par `?? []`, et ce contrat rend cette précaution superflue plutôt que
 * nécessaire.
 */
export function estPageValide(page) {
  return Boolean(page && typeof page === 'object' && Array.isArray(page.data))
}

/**
 * Une recommandation, telle que la modale la consomme.
 *
 * Le contrat n'exige pas les genres sur une suggestion — l'API historique ne
 * les joignait pas, et cette tolérance a été écrite pour elle. AniList les
 * fournit, avec `isAdult` : chaque suggestion est donc jugée pour elle-même, et
 * le repli sur le registre de la fiche ouverte ne sert plus.
 */
export function estRecommandationValide(entry) {
  return estAnimeAffichable(entry)
}

/**
 * Recense ce qui manque, pour un message d'erreur qui dit quoi corriger plutôt
 * que « invalide ».
 */
export function champsManquants(anime) {
  if (!anime || typeof anime !== 'object') return [...CHAMPS_REQUIS]
  return CHAMPS_REQUIS.filter(champ => {
    if (champ === 'images') return !estAnimeAffichable({ mal_id: 1, title: 'x', images: anime.images })
    if (champ === 'mal_id') return !Number.isFinite(anime.mal_id)
    return typeof anime[champ] !== 'string' || anime[champ].trim() === ''
  })
}
