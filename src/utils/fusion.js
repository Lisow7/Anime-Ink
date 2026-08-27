/**
 * Fusionne une liste restaurée dans une liste existante.
 *
 * Vit à part du reste de la sauvegarde, et pour une raison mesurable : les
 * trois contextes de persistance s'en servent, or ils sont chargés au
 * démarrage. Les faire dépendre du module de sauvegarde entier y ferait entrer
 * la lecture de fichier et la construction de l'export — du code qui ne sert
 * qu'à l'écran du profil, chargé à la demande.
 *
 * L'ordre n'est pas indifférent : le dédoublonnage des contextes garde la
 * **première** occurrence d'un identifiant. Placer l'existant devant, c'est
 * garantir qu'une restauration ne fait jamais reculer une progression — la
 * série suivie jusqu'à l'épisode 12 le reste, même si le fichier la connaît à
 * l'épisode 3.
 */
export function fusionner(existant, importe) {
  const vus = new Set((existant ?? []).map(e => e?.mal_id))
  return [...(existant ?? []), ...(importe ?? []).filter(e => !vus.has(e.mal_id))]
}
