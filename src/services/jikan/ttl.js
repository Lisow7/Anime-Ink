const HEURE = 60 * 60 * 1000
const JOUR = 24 * HEURE

/**
 * Durée de validité d'une réponse, par ressource.
 *
 * Le cache serveur de Jikan est de 24 h : mémoriser plus longtemps une fiche
 * d'animé n'apporterait rien, la rafraîchir plus souvent non plus. Les listes
 * et recherches bougent davantage, d'où une heure. Ce qui n'est pas reconnu
 * n'est pas mis en cache : mieux vaut une requête de trop qu'une donnée
 * périmée servie par erreur.
 */
export function ttlForPath(path) {
  if (path.startsWith('/random/')) return 0
  if (path.startsWith('/genres/')) return 7 * JOUR
  if (/^\/anime\/\d+(\/|$)/.test(path)) return JOUR
  if (path.startsWith('/top/') || path.startsWith('/anime?')) return HEURE
  return 0
}
