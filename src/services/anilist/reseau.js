import { JikanError } from '../jikan/client'
import { mettreAJourSante, statutDepuisReponse } from '../sante-api'
import { lireCle, OPERATIONS } from './requetes'

const ENDPOINT = 'https://graphql.anilist.co'
const DELAI_MS = 8000

/**
 * Sous quel reste de quota on s'arrête d'anticiper pour attendre franchement.
 *
 * AniList expose `X-RateLimit-Remaining` à chaque réponse — Jikan n'exposait
 * rien, ce qui obligeait à deviner. Le lire permet de ralentir **avant** le
 * refus plutôt que de le subir et de retenter.
 */
const SEUIL_PRUDENCE = 3

/** Ce que la dernière réponse a dit du quota. Utile aux tests et au diagnostic. */
let dernierQuota = { restant: null, resetA: null }

export function quotaConnu() {
  return dernierQuota
}

function noterQuota(reponse) {
  const restant = Number(reponse.headers?.get?.('X-RateLimit-Remaining'))
  const reset = Number(reponse.headers?.get?.('X-RateLimit-Reset'))
  dernierQuota = {
    restant: Number.isFinite(restant) ? restant : null,
    resetA: Number.isFinite(reset) ? reset * 1000 : null,
  }
}

/**
 * Attend la fin de la fenêtre quand il ne reste presque plus rien.
 *
 * Sans cela, les dernières requêtes du quota partiraient quand même, se
 * feraient refuser, et déclencheraient des reprises — trois appels perdus au
 * lieu d'une attente.
 */
async function menagerLeQuota(attendre) {
  const { restant, resetA } = dernierQuota
  if (restant === null || restant > SEUIL_PRUDENCE) return
  if (!resetA) return

  const patience = resetA - Date.now()
  // Une fenêtre dure une minute : au-delà, l'horodatage est suspect et mieux
  // vaut tenter sa chance que bloquer l'interface.
  if (patience > 0 && patience <= 60_000) await attendre(patience)
}

/**
 * Exécute une requête GraphQL et rend une `Response`, comme le ferait `fetch`.
 *
 * Rendre une `Response` plutôt que des données permet au client partagé de
 * garder sa logique intacte : il lit `.ok`, `.status` et les en-têtes sans
 * savoir qu'il parle à du GraphQL.
 *
 * **AniList répond `200` même sur une erreur GraphQL**, le corps portant alors
 * un tableau `errors`. S'en remettre au code HTTP mettrait cette erreur en
 * cache comme une réponse valide. Elle est donc retraduite en `Response`
 * fautive, avec un statut qui reflète ce qui s'est passé.
 */
export function creerReseauAniList({ attendre = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  return async function interroger(cle, { signal } = {}) {
    const { operation, variables } = lireCle(cle)
    const requete = OPERATIONS[operation]
    if (!requete) throw new JikanError(`Opération AniList inconnue : ${operation}`, { status: 400 })

    await menagerLeQuota(attendre)

    const controller = new AbortController()
    let expire = false
    const minuterie = setTimeout(() => { expire = true; controller.abort() }, DELAI_MS)
    const relayer = () => controller.abort()
    signal?.addEventListener('abort', relayer, { once: true })

    try {
      const reponse = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: requete.query, variables }),
        signal: controller.signal,
      })

      noterQuota(reponse)
      if (!reponse.ok) {
        mettreAJourSante(statutDepuisReponse(reponse.status))
        return reponse
      }

      const corps = await reponse.json()
      if (Array.isArray(corps?.errors) && corps.errors.length > 0) {
        const message = corps.errors[0]?.message ?? 'Requête AniList refusée'
        // 400 : la requête est en cause, pas le service. Le client ne la
        // réessaiera pas, et ne servira pas de copie périmée à sa place.
        const statut = corps.errors[0]?.status ?? 400
        // Le voyant est jugé sur le statut porté par l'erreur, pas sur le 200
        // de l'enveloppe : AniList rend ses pannes comme ses refus en 200, et
        // s'en tenir au code HTTP afficherait « disponible » pendant une panne.
        mettreAJourSante(statutDepuisReponse(statut))
        return new Response(JSON.stringify({ message }), {
          status: statut,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      mettreAJourSante('available')

      // Le corps a été lu : il faut en refabriquer un que le client puisse lire
      // à son tour.
      return new Response(JSON.stringify(corps), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (erreur) {
      if (signal?.aborted) throw erreur
      mettreAJourSante('unavailable')
      if (expire) throw new JikanError('AniList n’a pas répondu à temps', { cause: erreur })
      throw erreur
    } finally {
      clearTimeout(minuterie)
      signal?.removeEventListener('abort', relayer)
    }
  }
}
