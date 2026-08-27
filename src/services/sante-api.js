/**
 * L'état de santé de la source de données, indépendant de laquelle il s'agit.
 *
 * Le voyant du pied de page et la mention « données du … » ne parlent pas de
 * la source : ils disent à l'utilisateur si ce qu'il regarde est frais. Cet
 * état vivait dans l'adaptateur historique, ce qui le rendait inatteignable
 * depuis le suivant — le voyant serait resté sur « inconnu » à vie après la
 * bascule.
 *
 * Chaque adaptateur y verse ce qu'il observe ; le pied de page s'y abonne sans
 * savoir qui l'alimente.
 */

let sante = { status: 'unknown', checkedAt: null, staleSince: null }
const abonnes = new Set()

function diffuser() {
  abonnes.forEach(ecouter => ecouter(sante))
}

/**
 * Ce qu'un code HTTP dit de la **source**, et non de la requête.
 *
 * Un 4xx signale une requête en cause — fiche inexistante, requête refusée —
 * pas un service tombé. Le traiter comme une panne allumerait le voyant rouge
 * parce qu'un utilisateur a ouvert une fiche supprimée. AniList rend d'ailleurs
 * ses erreurs de requête en 400 fabriqué depuis un corps GraphQL reçu en 200 :
 * les compter comme des pannes rendrait le voyant franchement mensonger.
 *
 * @returns {'available'|'degraded'|'unavailable'|null} `null` = ne rien changer
 */
export function statutDepuisReponse(status) {
  if (status >= 200 && status < 300) return 'available'
  if (status === 429) return 'degraded'
  if (status >= 500) return 'unavailable'
  return null
}

/**
 * Enregistre ce que la source vient de faire.
 *
 * @param {'available'|'degraded'|'unavailable'|null} statut `null` est ignoré,
 *   ce qui permet d'appeler directement avec le retour de
 *   `statutDepuisReponse` sans garde à chaque site d'appel.
 */
export function mettreAJourSante(statut) {
  if (!statut) return
  // Une réponse fraîche annule le signalement : ce qui s'affiche n'est plus une
  // copie de secours.
  const staleSince = statut === 'available' ? null : sante.staleSince
  sante = { status: statut, checkedAt: Date.now(), staleSince }
  diffuser()
}

/**
 * Une réponse périmée vient d'être resservie. L'utilisateur regarde des données
 * qui peuvent dater : le lui taire serait lui laisser croire qu'elles sont
 * fraîches.
 */
export function signalerDonneePerimee(storedAt) {
  if (!Number.isFinite(storedAt)) return
  if (sante.staleSince === storedAt) return
  sante = { ...sante, staleSince: storedAt }
  diffuser()
}

export function getApiHealth() {
  return sante
}

export function subscribeApiHealth(listener) {
  abonnes.add(listener)
  listener(sante)
  return () => abonnes.delete(listener)
}

/** Remet l'état à neuf. Réservé aux tests : sans cela, l'état d'un cas fuit
 *  dans le suivant et le voyant paraît allumé pour la mauvaise raison. */
export function reinitialiserSante() {
  sante = { status: 'unknown', checkedAt: null, staleSince: null }
  abonnes.clear()
}
