/**
 * URL de la jaquette d'un animé, en préférant le WebP.
 *
 * Jikan sert les deux formats aux mêmes dimensions — vérifié au pixel sur
 * plusieurs paires — et le WebP pèse environ 40 % de moins. Le gain est donc
 * gratuit, sans perte de définition. Le repli sur le JPG reste indispensable :
 * certaines fiches anciennes n'ont pas la variante WebP renseignée.
 *
 * À ne pas utiliser pour les métadonnées Open Graph : tous les robots sociaux
 * ne lisent pas le WebP.
 */
export function posterUrl(images, { large = false } = {}) {
  const ordre = large
    ? ['webp.large_image_url', 'jpg.large_image_url', 'webp.image_url', 'jpg.image_url']
    : ['webp.image_url', 'jpg.image_url', 'webp.large_image_url', 'jpg.large_image_url']

  for (const chemin of ordre) {
    const [format, taille] = chemin.split('.')
    const url = images?.[format]?.[taille]
    if (url) return url
  }

  return undefined
}
