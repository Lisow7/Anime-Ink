import { genresDepuisAniList } from './genres'

/**
 * Traduit une réponse AniList vers le contrat de l'application.
 *
 * Tout est ici en fonctions pures : elles ne connaissent ni le réseau, ni le
 * cache, ni React. C'est ce qui permet de les éprouver sur des réponses réelles
 * capturées, sans rien simuler.
 *
 * Chaque conversion ci-dessous répare un écart mesuré entre les deux API — on
 * ne devine pas, on traduit ce qu'on a observé.
 */

/** AniList compte sur 100, l'application affiche sur 10. */
export function scoreSurDix(averageScore) {
  if (!Number.isFinite(averageScore)) return null
  return Math.round(averageScore) / 10
}

/**
 * `FINISHED` → `Finished Airing`.
 *
 * Les libellés de MyAnimeList ne sont pas décoratifs : `STATUS_LABEL` les
 * traduit pour l'affichage, et le filtre du catalogue les compare. Un statut
 * non converti afficherait « FINISHED » en clair et casserait le filtre.
 */
const STATUTS = {
  FINISHED: 'Finished Airing',
  RELEASING: 'Currently Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'On Hiatus',
}

export function statutDepuisAniList(status) {
  return STATUTS[status] ?? null
}

/** `MOVIE` → `Movie`. Les valeurs du filtre de type sont en minuscules côté URL. */
const FORMATS = {
  TV: 'TV',
  TV_SHORT: 'TV',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
}

export function typeDepuisAniList(format) {
  return FORMATS[format] ?? null
}

/**
 * AniList donne des minutes ; l'application affiche la chaîne telle quelle.
 *
 * Reproduire la forme de MyAnimeList — « 24 min per ep » — évite de toucher aux
 * composants pour cette seule phase. C'est un candidat au nettoyage le jour où
 * l'affichage saura formater un nombre lui-même.
 */
export function dureeDepuisAniList(minutes, format) {
  if (!Number.isFinite(minutes)) return null
  return format === 'MOVIE' ? `${minutes} min` : `${minutes} min per ep`
}

const MOIS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function dateISO({ year, month, day } = {}) {
  if (!Number.isFinite(year)) return null
  const m = String(month ?? 1).padStart(2, '0')
  const j = String(day ?? 1).padStart(2, '0')
  return `${year}-${m}-${j}T00:00:00+00:00`
}

function dateLisible({ year, month, day } = {}) {
  if (!Number.isFinite(year)) return null
  if (!Number.isFinite(month)) return String(year)
  const mois = MOIS[month - 1] ?? ''
  return Number.isFinite(day) ? `${mois} ${day}, ${year}` : `${mois} ${year}`
}

/**
 * AniList structure ses dates, MyAnimeList les rend en texte. Le contrat porte
 * les deux : `from` sert au tri des résultats, `string` à l'affichage.
 */
export function diffusionDepuisAniList(startDate, endDate) {
  const debut = dateLisible(startDate)
  const fin = dateLisible(endDate)
  return {
    from: dateISO(startDate),
    to: dateISO(endDate),
    string: debut ? (fin ? `${debut} to ${fin}` : `${debut} to ?`) : null,
  }
}

/**
 * AniList sert une seule image par taille ; le contrat attend les deux formats.
 *
 * Les mêmes adresses sont donc rangées sous `jpg` et sous `webp` : `posterUrl`
 * choisit `webp` en priorité, et doit trouver quelque chose. AniList sert du
 * PNG — moins léger que le WebP de MyAnimeList, c'est un écart à mesurer avant
 * la bascule.
 */
export function imagesDepuisAniList(coverImage) {
  const grande = coverImage?.extraLarge ?? coverImage?.large ?? null
  const moyenne = coverImage?.large ?? coverImage?.medium ?? grande
  if (!grande && !moyenne) return null
  const jeu = { image_url: moyenne, large_image_url: grande ?? moyenne }
  return { jpg: { ...jeu }, webp: { ...jeu } }
}

/**
 * La description d'AniList contient du HTML — `<br>`, `<i>`, parfois des liens.
 *
 * L'application n'injecte jamais de HTML : `dangerouslySetInnerHTML` n'apparaît
 * nulle part, React échappe donc tout. Ce nettoyage n'est pas une protection
 * contre l'injection, c'est une question de lisibilité — sans lui, un visiteur
 * lirait « <br> » dans le synopsis, et la balise `description` de la page
 * porterait le même bruit.
 */
export function synopsisDepuisAniList(description) {
  if (typeof description !== 'string') return null
  const texte = description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return texte === '' ? null : texte
}

/** AniList donne l'identifiant YouTube et le site ; le contrat veut une URL d'intégration. */
export function bandeAnnonceDepuisAniList(trailer) {
  if (!trailer?.id || trailer.site !== 'youtube') return null
  return {
    youtube_id: trailer.id,
    embed_url: `https://www.youtube-nocookie.com/embed/${trailer.id}`,
    url: `https://www.youtube.com/watch?v=${trailer.id}`,
  }
}

/** Le rang « toutes périodes » sur la note, l'équivalent le plus proche de `rank`. */
function rangDepuisAniList(rankings) {
  const rang = (rankings ?? []).find(r => r.type === 'RATED' && r.allTime)
  return Number.isFinite(rang?.rank) ? rang.rank : null
}

/**
 * Un média AniList traduit vers le contrat.
 *
 * `isAdult` est remonté tel quel, en plus des genres : c'est le marqueur fiable
 * du contenu adulte chez AniList, où des titres explicites ne portent pas
 * « Hentai » dans leurs genres.
 */
export function animeDepuisAniList(media) {
  if (!media || !Number.isFinite(media.idMal)) return null

  return {
    mal_id: media.idMal,
    url: media.siteUrl ?? null,
    title: media.title?.romaji ?? media.title?.english ?? null,
    title_english: media.title?.english ?? null,
    title_japanese: media.title?.native ?? null,
    images: imagesDepuisAniList(media.coverImage),
    score: scoreSurDix(media.averageScore),
    scored_by: Number.isFinite(media.popularity) ? media.popularity : null,
    rank: rangDepuisAniList(media.rankings),
    popularity: Number.isFinite(media.popularity) ? media.popularity : null,
    type: typeDepuisAniList(media.format),
    episodes: Number.isFinite(media.episodes) ? media.episodes : null,
    duration: dureeDepuisAniList(media.duration, media.format),
    status: statutDepuisAniList(media.status),
    airing: media.status === 'RELEASING',
    aired: diffusionDepuisAniList(media.startDate, media.endDate),
    season: media.season ? media.season.toLowerCase() : null,
    year: Number.isFinite(media.seasonYear) ? media.seasonYear : null,
    synopsis: synopsisDepuisAniList(media.description),
    genres: genresDepuisAniList(media.genres),
    studios: (media.studios?.nodes ?? []).map(s => ({ mal_id: s.id, name: s.name })),
    trailer: bandeAnnonceDepuisAniList(media.trailer),
    isAdult: Boolean(media.isAdult),
  }
}

/** La pagination d'AniList vers celle que le catalogue lit. */
export function paginationDepuisAniList(pageInfo) {
  return {
    current_page: pageInfo?.currentPage ?? 1,
    last_visible_page: pageInfo?.lastPage ?? 1,
    has_next_page: Boolean(pageInfo?.hasNextPage),
    items: { total: pageInfo?.total ?? null },
  }
}
