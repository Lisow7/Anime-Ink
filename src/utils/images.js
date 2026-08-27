/* global __OPTIMISE_IMAGES__ */

/**
 * Les largeurs que l'hébergement accepte de produire.
 *
 * Elles doivent correspondre **exactement** à `images.sizes` de `vercel.json` :
 * une largeur absente de cette liste fait répondre une erreur, pas une image.
 *
 * Une seule suffit, et c'est délibéré. Le plus grand emplacement du site fait
 * 192 pixels ; 256 les sert tous avec de la marge. Surtout, **la même image
 * transformée sert partout** — une carte, une suggestion et une fiche
 * partagent la même entrée de cache. Multiplier les largeurs multiplierait les
 * transformations facturées pour un gain invisible sur des vignettes.
 */
export const LARGEURS = [256]

/** Doit figurer dans `images.qualities` de `vercel.json`, même raison. */
const QUALITE = 70

/**
 * Fait passer une jaquette par l'optimiseur de l'hébergement.
 *
 * AniList ne sert que du PNG : ni variante WebP, ni négociation de contenu —
 * les trois vérifiés. La conversion ne peut donc venir que de l'hôte, et
 * `/_vercel/image` n'existe que chez Vercel. Ailleurs, l'adresse d'origine est
 * rendue telle quelle : le site reste correct, simplement plus lourd.
 *
 * Mesuré : 137 ko de PNG pour une jaquette de catalogue, contre 13 ko pour la
 * même image en WebP chez la source précédente.
 */
export function optimiser(url, largeur) {
  const actif = typeof __OPTIMISE_IMAGES__ === 'boolean' ? __OPTIMISE_IMAGES__ : false
  if (!actif || !url) return url

  // Une image déjà servie par l'optimiseur ne doit pas y repasser, et les
  // adresses locales n'ont rien à y gagner.
  if (url.startsWith('/_vercel/image')) return url

  const w = LARGEURS.includes(largeur) ? largeur : LARGEURS[0]
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=${QUALITE}`
}

/**
 * URL de la jaquette d'un animé, en préférant le WebP.
 *
 * La source précédente servait les deux formats aux mêmes dimensions — vérifié
 * au pixel sur plusieurs paires — et le WebP pesait environ 40 % de moins. Le
 * repli sur le JPG reste indispensable : certaines fiches anciennes n'ont pas
 * la variante WebP renseignée, et les favoris enregistrés de longue date
 * portent des adresses de cette époque.
 *
 * `largeur` demande une définition à l'optimiseur, quand il y en a un. Sans
 * lui, elle n'a aucun effet : l'image d'origine est servie telle quelle.
 *
 * À ne pas utiliser pour les métadonnées Open Graph : tous les robots sociaux
 * ne lisent pas le WebP, et `large_image_url` leur est réservé.
 */
export function posterUrl(images, { large = false, largeur } = {}) {
  const ordre = large
    ? ['webp.large_image_url', 'jpg.large_image_url', 'webp.image_url', 'jpg.image_url']
    : ['webp.image_url', 'jpg.image_url', 'webp.large_image_url', 'jpg.large_image_url']

  for (const chemin of ordre) {
    const [format, taille] = chemin.split('.')
    const url = images?.[format]?.[taille]
    if (url) return optimiser(url, largeur)
  }

  return undefined
}
