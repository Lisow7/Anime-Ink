/**
 * Confronte la **vraie** API aux requêtes du dépôt.
 *
 * ## L'angle mort que ce script comble
 *
 * Les tests utilisent des jeux de données figés. C'est ce qui les rend fiables
 * — la CI ne doit dépendre d'aucun tiers — mais cela crée un point aveugle
 * exact : **si AniList renomme ou retire un champ demain, la suite de
 * conformité passera indéfiniment**, puisqu'elle interroge des fixtures, pas
 * l'API. L'écran, lui, se videra.
 *
 * Le risque était supportable tant que deux sources coexistaient. Depuis qu'il
 * n'en reste qu'une, plus rien ne se met en travers.
 *
 * ## Ce qui rend la détection possible
 *
 * GraphQL **refuse** une requête qui demande un champ inexistant, au lieu de
 * l'ignorer. Envoyer les vraies requêtes du dépôt — importées d'ici, jamais
 * recopiées — suffit donc à faire tomber le script le jour où la source change
 * de forme. S'ajoutent quelques vérifications de sens, car un champ peut
 * survivre en changeant de nature.
 *
 * ## Pourquoi il ne tourne pas dans la CI des pull requests
 *
 * Parce qu'il dépend d'un service extérieur, et qu'un garde-fou qui rougit au
 * gré de l'humeur d'un tiers finit ignoré — pire que pas de garde-fou. Il
 * tourne à part : chaque semaine, sans bloquer personne, et à la demande quand
 * un doute survient.
 *
 * Il ne remplace pas la suite de conformité : celle-ci vérifie que la
 * **traduction** est juste, celui-ci que la **matière première** est là.
 */
import { OPERATIONS } from '../src/services/anilist/requetes.js'

const ENDPOINT = 'https://graphql.anilist.co'

/** Cowboy Bebop : ancien, stable, référencé des deux côtés depuis toujours. */
const REPERE = 1
/** One Piece : en diffusion depuis 1999, donc toujours un épisode à venir. */
const EN_DIFFUSION = 21
/** L'Attaque des Titans : une chaîne de suites qui ne bougera plus. */
const FRANCHISE = 16498

/**
 * Chaque cas dit ce qu'il envoie, ce qu'il attend, et **pourquoi ça compte** —
 * de sorte qu'un échec explique la conséquence sans qu'on ait à la déduire.
 */
const CAS = [
  {
    operation: 'media',
    variables: { idMal: REPERE },
    pourquoi: 'la modale et la page de détail en dépendent entièrement',
    verifier(data) {
      const m = data?.Media
      if (!m) return 'aucune fiche rendue'
      if (!Number.isFinite(m.idMal)) return 'la fiche n’a plus d’identifiant MyAnimeList — favoris et liens partagés le utilisent'
      if (!m.title?.romaji && !m.title?.english) return 'la fiche n’a plus de titre'
      if (!m.coverImage?.large && !m.coverImage?.extraLarge) return 'la fiche n’a plus de jaquette'
      // La note est convertie en barème sur dix : si la source passait déjà sur
      // dix, la conversion afficherait 0,9 sur 10.
      if (m.averageScore !== null && (m.averageScore < 0 || m.averageScore > 100)) {
        return `la note vaut ${m.averageScore} — le barème sur cent n'est plus respecté`
      }
      if (!Array.isArray(m.genres)) return 'les genres ne sont plus une liste — le filtre d’âge en dépend'
      if (typeof m.isAdult !== 'boolean') return 'la mention d’âge a changé de nature — le floutage en dépend'
      return null
    },
  },
  {
    operation: 'recherche',
    variables: { search: 'cowboy bebop' },
    pourquoi: 'la barre de recherche est la première chose que voit un visiteur',
    verifier: (data) => (data?.Page?.media?.length > 0 ? null : 'une recherche évidente ne rend plus rien'),
  },
  {
    operation: 'classement',
    variables: { page: 1 },
    pourquoi: 'la page d’accueil s’en sert, et une page vide y passe pour un chargement',
    verifier(data) {
      if (!(data?.Page?.media?.length > 0)) return 'le classement ne rend plus aucun titre'
      if (!Number.isFinite(data.Page.pageInfo?.lastPage)) return 'la pagination a changé de forme'
      return null
    },
  },
  {
    operation: 'catalogue',
    variables: { page: 1, sort: 'SCORE_DESC', genre: 'Action', status: 'FINISHED', format: 'TV' },
    pourquoi: 'les filtres du catalogue reposent sur des noms de genres',
    verifier: (data) => (data?.Page?.media?.length > 0
      ? null
      : 'le filtre par genre ne rend plus rien — la table de genres a peut-être dérivé'),
  },
  {
    operation: 'recommandations',
    variables: { idMal: REPERE },
    pourquoi: 'les suggestions portent les genres qui décident du floutage',
    verifier(data) {
      const nodes = data?.Media?.recommendations?.nodes
      if (!(nodes?.length > 0)) return 'un titre populaire ne rend plus aucune suggestion'
      // Sans genres, le floutage retomberait sur le registre de la fiche
      // ouverte — la limite que la bascule avait justement levée.
      return nodes.some(n => Array.isArray(n?.mediaRecommendation?.genres))
        ? null
        : 'les suggestions ne portent plus de genres'
    },
  },
  {
    operation: 'relations',
    variables: { idMal: FRANCHISE },
    pourquoi: 'le sélecteur de saisons et la liste de suivi parcourent ces liens',
    verifier(data) {
      const aretes = data?.Media?.relations?.edges
      if (!(aretes?.length > 0)) return 'une franchise connue ne déclare plus de relations'
      if (!aretes.some(a => a.relationType === 'SEQUEL')) return 'les suites ne sont plus étiquetées SEQUEL'
      // Le format porté par le nœud est ce qui évite de charger les branches
      // non télévisées : sans lui, le parcours redeviendrait coûteux.
      return aretes.every(a => 'format' in (a.node ?? {})) ? null : 'les nœuds ne portent plus leur format'
    },
  },
  {
    operation: 'prochainsEpisodes',
    variables: { ids: [EN_DIFFUSION, REPERE], perPage: 50 },
    pourquoi: '« Reprendre » et « Cette semaine » en vivent',
    verifier(data) {
      const medias = data?.Page?.media
      if (!(medias?.length > 0)) return 'la requête groupée ne rend plus rien — `idMal_in` a peut-être changé'
      const enCours = medias.find(m => m.idMal === EN_DIFFUSION)
      if (!enCours) return 'une série en diffusion est absente de la réponse groupée'
      const suivant = enCours.nextAiringEpisode
      if (!suivant) return 'une série en diffusion n’annonce plus de prochain épisode'
      if (!Number.isFinite(suivant.episode)) return 'le numéro d’épisode n’est plus un nombre'
      // La date est comptée en secondes : passée en millisecondes, elle
      // situerait les sorties en l'an 57 000 sans qu'aucune erreur ne survienne.
      const annee = new Date(suivant.airingAt * 1000).getFullYear()
      if (annee < 2000 || annee > 2100) return `la date de diffusion tombe en ${annee} — l'unité de temps a changé`
      return null
    },
  },
]

async function interroger(operation, variables) {
  const requete = OPERATIONS[operation]
  if (!requete) throw new Error(`opération « ${operation} » absente du dépôt`)

  const reponse = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: requete.query, variables }),
  })

  const corps = await reponse.json().catch(() => null)

  // GraphQL refuse une requête qui demande un champ inexistant : c'est ici que
  // se voit une disparition de champ, avant même les vérifications de sens.
  if (Array.isArray(corps?.errors) && corps.errors.length > 0) {
    throw new Error(`refusée — ${corps.errors[0].message}`)
  }
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)

  return corps?.data
}

const echecs = []

for (const cas of CAS) {
  try {
    const probleme = cas.verifier(await interroger(cas.operation, cas.variables))
    if (probleme) {
      echecs.push({ ...cas, probleme })
      console.log(`  ÉCHEC ${cas.operation}\n        ${probleme}`)
    } else {
      console.log(`  ok    ${cas.operation}`)
    }
  } catch (erreur) {
    // Une panne passagère n'est pas une rupture de contrat, mais on ne peut pas
    // conclure : mieux vaut le dire que de rendre un vert trompeur.
    echecs.push({ ...cas, probleme: erreur.message })
    console.log(`  ÉCHEC ${cas.operation}\n        ${erreur.message}`)
  }

  // La source applique trente requêtes par minute : les espacer évite de
  // provoquer soi-même le refus qu'on est venu détecter.
  await new Promise(r => setTimeout(r, 2100))
}

console.log(`\n${CAS.length} opérations vérifiées, ${echecs.length} en échec.`)

if (echecs.length > 0) {
  console.log('\nCe que ces échecs veulent dire :')
  for (const { operation, pourquoi } of echecs) console.log(`  · ${operation} — ${pourquoi}`)
  console.log(
    '\nSi l’API est simplement indisponible, relancer plus tard suffit. Si le'
    + '\nproblème persiste, la source a changé de forme et le dépôt doit suivre :'
    + '\n  src/services/anilist/requetes.js    (les champs demandés)'
    + '\n  src/services/anilist/traduction.js  (leur passage vers le contrat)',
  )
  process.exit(1)
}

console.log('La source rend toujours ce que le site attend.')
