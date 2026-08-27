import { typeDepuisAniList } from './traduction'

/**
 * Reconstituer une franchise à partir des relations déclarées par AniList.
 *
 * L'adaptateur historique devinait la franchise en **cherchant le titre** :
 * il interrogeait `/anime?q=<titre normalisé>` et gardait ce qui ressemblait.
 * D'où une pile d'exceptions — titres inversés « SousTitre: Franchise », replis
 * sur le sous-titre, cas particuliers rattrapés dans la modale — et des ratés
 * sur les franchises dont les titres ne se ressemblent pas.
 *
 * AniList **déclare** ses relations. Il n'y a plus rien à deviner : la chaîne
 * des saisons se parcourt de proche en proche, et les films, OVA et spéciaux
 * viennent avec.
 *
 * Second gain, moins visible : chaque nœud porte déjà son format et son nombre
 * d'épisodes. Le parcours ne demande donc que les titres **télévisés**, seuls
 * susceptibles de prolonger la chaîne, là où l'API historique devait charger
 * chaque séquelle pour découvrir de quel type elle était.
 */

// Une franchise se parcourt de proche en proche : sans borne, une longue série
// consomme des dizaines de requêtes sur un budget de trente par minute. Ces
// deux plafonds couvrent largement les franchises réelles.
const MAX_SAISONS = 6
const MAX_APPELS = 12

/** Les formats qui comptent comme une saison. */
const FORMATS_TV = new Set(['TV', 'TV_SHORT'])

/**
 * Relations qui n'appartiennent pas à la franchise.
 *
 * `CHARACTER` relie deux séries qui partagent un personnage sans rien avoir de
 * commun par ailleurs — l'inclure ferait apparaître des titres étrangers dans
 * le sélecteur. `ADAPTATION` pointe vers l'œuvre d'origine, souvent un manga.
 */
const RELATIONS_ETRANGERES = new Set(['CHARACTER', 'ADAPTATION', 'OTHER'])

/** Un nœud de relation, réduit à ce dont la franchise a besoin. */
function lireNoeud(node) {
  if (!node || node.type !== 'ANIME' || !Number.isFinite(node.idMal)) return null
  return {
    mal_id: node.idMal,
    title: node.title?.romaji ?? node.title?.english ?? null,
    episodes: Number.isFinite(node.episodes) ? node.episodes : null,
    year: Number.isFinite(node.seasonYear) ? node.seasonYear : null,
    format: node.format ?? null,
  }
}

function liensDeType(media, relationType) {
  return (media?.relations?.edges ?? [])
    .filter(e => e?.relationType === relationType)
    .map(e => lireNoeud(e.node))
    .filter(Boolean)
}

/**
 * Le libellé court d'un titre annexe, tel que la modale l'affiche.
 *
 * « Shingeki no Kyojin: Chronicle » se réduit à « Chronicle » ; un titre sans
 * sous-titre retombe sur son type, faute de mieux à montrer.
 */
function libelle(titre, type) {
  const separateur = titre?.indexOf(': ') ?? -1
  if (separateur > 0) return titre.slice(separateur + 2)
  return type ?? titre ?? ''
}

/**
 * Parcourt la franchise d'un titre.
 *
 * @param {number} idDepart identifiant MyAnimeList du titre ouvert
 * @param {Function} demanderRelations `idMal => Media` ; rend `null` en cas d'échec
 * @returns {Promise<{saisons: Array, autres: Array}>}
 */
export async function parcourirFranchise(idDepart, demanderRelations) {
  const connus = new Map()
  let appels = 0

  async function relationsDe(id) {
    if (connus.has(id)) return connus.get(id)
    if (appels >= MAX_APPELS) return null

    appels += 1
    const media = await demanderRelations(id)
    connus.set(id, media)
    return media
  }

  const depart = await relationsDe(idDepart)
  if (!depart) return { saisons: [], autres: [] }

  // Remonter jusqu'à la première saison : ce que l'utilisateur a ouvert n'est
  // pas forcément le début de la série, et un sélecteur qui commencerait à la
  // saison 3 masquerait les précédentes.
  let racine = { mal_id: depart.idMal ?? idDepart, media: depart }
  const remontes = new Set([racine.mal_id])

  while (true) {
    // Seule une antériorité télévisée est une saison : « Shingeki no Kyojin »
    // a pour PREQUEL un OVA, qui ne doit pas devenir la racine de la chaîne.
    const precedent = liensDeType(racine.media, 'PREQUEL')
      .find(n => FORMATS_TV.has(n.format) && !remontes.has(n.mal_id))
    if (!precedent) break

    const media = await relationsDe(precedent.mal_id)
    if (!media) break
    remontes.add(precedent.mal_id)
    racine = { mal_id: precedent.mal_id, media }
  }

  // Descendre la chaîne des séquelles télévisées, en récoltant au passage tout
  // ce qui gravite autour.
  const saisons = []
  const autres = []
  const vus = new Set()

  function noterAutres(media) {
    for (const lien of media?.relations?.edges ?? []) {
      if (RELATIONS_ETRANGERES.has(lien?.relationType)) continue
      const noeud = lireNoeud(lien.node)
      if (!noeud || FORMATS_TV.has(noeud.format) || vus.has(noeud.mal_id)) continue
      vus.add(noeud.mal_id)
      const type = typeDepuisAniList(noeud.format)
      autres.push({ mal_id: noeud.mal_id, title: noeud.title, type, label: libelle(noeud.title, type) })
    }
  }

  let courant = racine
  while (courant && saisons.length < MAX_SAISONS) {
    const media = courant.media
    vus.add(courant.mal_id)

    if (FORMATS_TV.has(media.format)) {
      saisons.push({
        mal_id: courant.mal_id,
        title: media.title?.romaji ?? media.title?.english ?? null,
        episodes: Number.isFinite(media.episodes) ? media.episodes : null,
        year: Number.isFinite(media.seasonYear) ? media.seasonYear : null,
      })
    }
    noterAutres(media)

    const suivante = liensDeType(media, 'SEQUEL').find(n => FORMATS_TV.has(n.format) && !vus.has(n.mal_id))
    if (!suivante) break

    const suivantMedia = await relationsDe(suivante.mal_id)
    if (!suivantMedia) break
    courant = { mal_id: suivante.mal_id, media: suivantMedia }
  }

  return { saisons, autres }
}
