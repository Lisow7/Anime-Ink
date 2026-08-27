/**
 * Les 19 genres d'AniList, rattachés à leur identifiant MyAnimeList.
 *
 * AniList ne rend que des noms — `["Action", "Adventure"]` — là où le contrat
 * attend `[{ mal_id, name }]`. Il faut donc un identifiant, et le prendre chez
 * MyAnimeList plutôt que d'en inventer a une conséquence concrète : les URL
 * déjà partagées, du type `?genre=1`, continuent de désigner la même chose, et
 * les favoris enregistrés restent lisibles.
 *
 * La correspondance a été établie en croisant `GenreCollection` d'AniList avec
 * la liste MyAnimeList complète : **18 noms sur 19 coïncident au caractère
 * près**. Le dernier mérite son explication.
 *
 * ## Le cas « Thriller »
 *
 * MyAnimeList n'a pas de genre « Thriller » : il l'a renommé **« Suspense »**,
 * et lui a gardé l'identifiant `41`. Les deux désignent le même registre —
 * c'est un changement d'étiquette, pas de sens.
 *
 * ## Ce que cette table n'est pas
 *
 * Une équivalence de catalogues. MyAnimeList compte 78 genres, AniList 19 : un
 * animé rangé sous « Award Winning » chez l'un n'aura pas d'équivalent chez
 * l'autre. La table traduit ce qu'AniList dit, elle ne comble pas ce qu'il ne
 * dit pas.
 */
export const ID_MAL_PAR_GENRE_ANILIST = {
  Action: 1,
  Adventure: 2,
  Comedy: 4,
  Drama: 8,
  Ecchi: 9,
  Fantasy: 10,
  Hentai: 12,
  Horror: 14,
  'Mahou Shoujo': 66,
  Mecha: 18,
  Music: 19,
  Mystery: 7,
  Psychological: 40,
  Romance: 22,
  'Sci-Fi': 24,
  'Slice of Life': 36,
  Sports: 30,
  Supernatural: 37,
  // MyAnimeList l'appelle « Suspense » depuis 2022 ; même registre, même
  // identifiant. Sans cette ligne, le seul genre AniList sans correspondance
  // directe serait perdu.
  Thriller: 41,
}

/**
 * Traduit les noms d'AniList vers la forme attendue par le contrat.
 *
 * Un genre inconnu de la table est **écarté**, pas doté d'un identifiant
 * improvisé : un `mal_id` inventé se retrouverait dans une URL partageable et
 * dans des favoris persistés, où il ne voudrait rien dire. Mieux vaut un genre
 * de moins qu'un identifiant qui ment.
 */
export function genresDepuisAniList(noms) {
  if (!Array.isArray(noms)) return []
  return noms
    .filter(nom => ID_MAL_PAR_GENRE_ANILIST[nom] !== undefined)
    .map(nom => ({ mal_id: ID_MAL_PAR_GENRE_ANILIST[nom], name: nom }))
}

/** La liste complète, pour le menu du catalogue, triée comme il l'affiche. */
export function catalogueDesGenres() {
  return Object.entries(ID_MAL_PAR_GENRE_ANILIST)
    .map(([name, mal_id]) => ({ mal_id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Le chemin inverse : d'un identifiant MyAnimeList vers le nom qu'AniList attend. */
export function nomAniListDepuisIdMal(malId) {
  const id = Number(malId)
  return Object.keys(ID_MAL_PAR_GENRE_ANILIST).find(
    nom => ID_MAL_PAR_GENRE_ANILIST[nom] === id,
  )
}
