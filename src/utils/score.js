/**
 * Couleur d'une note, adaptée au thème.
 *
 * Les trois teintes vives d'origine échouaient toutes au contraste sur fond
 * clair (2,09 · 1,97 · 3,82 pour un seuil de 4,5). Les variables de thème
 * portent une variante assombrie côté clair et gardent les teintes vives côté
 * sombre.
 */
export function scoreColor(score) {
  if (score >= 7.5) return 'var(--score-good)'
  if (score >= 6) return 'var(--score-mid)'
  return 'var(--score-bad)'
}

/**
 * Variante pour une note posée sur un voile sombre — la pastille des jaquettes.
 * Ce fond ne change pas avec le thème : la couleur ne doit donc pas en changer
 * non plus, sans quoi elle deviendrait sombre sur sombre en thème clair.
 */
export function scoreColorOnOverlay(score) {
  if (score >= 7.5) return '#22c55e'
  if (score >= 6) return '#f59e0b'
  return '#e63946'
}
