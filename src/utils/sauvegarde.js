/**
 * Sauvegarder et restaurer ce que le visiteur a constitué.
 *
 * Tout vit dans le navigateur — c'est ce qui permet au site de n'avoir ni
 * compte ni serveur. Le revers, c'est qu'un « effacer les données du site », un
 * changement de machine ou un nettoyage automatique emporte les favoris, la
 * liste de suivi et l'historique **sans recours**. Ce module est ce recours.
 *
 * ## Ce que la sauvegarde ne contient pas
 *
 * Le **consentement** n'y figure pas, et ce n'est pas un oubli : le restaurer
 * depuis un fichier fabriquerait un accord que la personne n'a pas donné sur
 * cette machine-là. Il doit être redemandé, comme à la première visite.
 *
 * Les caches non plus — réponses de l'API, traductions, genres. Ils se
 * reconstituent seuls et ne sont pas des données de l'utilisateur.
 *
 * ## Le principe de la restauration : compléter, jamais détruire
 *
 * Une restauration **ajoute ce qui manque et ne touche pas à ce qui existe**.
 * Importer une vieille sauvegarde sur des données récentes ne peut donc pas
 * faire reculer une progression — et l'on n'a jamais à choisir entre les deux
 * en aveugle.
 */

/** Ce que le fichier porte. Un cran de plus si sa forme devait changer. */
export { fusionner } from './fusion'

/** Ce que le fichier porte. Un cran de plus si sa forme devait changer. */
export const VERSION = 1

/** Les jeux sauvegardés, et la clé de stockage de chacun. */
export const JEUX = {
  favoris: 'anime-ink-favorites',
  liste: 'anime-ink-watchlist',
  historique: 'anime-ink-history',
}

/**
 * Une entrée exploitable.
 *
 * Volontairement plus permissif que le contrat des fiches : celui-ci décrit ce
 * qu'une **source** doit rendre pour être affichable, tandis qu'une entrée
 * enregistrée peut être ancienne, partielle, ou avoir perdu sa jaquette. Le
 * seul champ dont tout le code dépend est l'identifiant — c'est par lui que les
 * listes se dédoublonnent et que les fiches se retrouvent.
 *
 * Refuser plus que nécessaire reviendrait à jeter des données que
 * l'application, elle, sait afficher.
 */
function estEntreeValide(entree) {
  return Boolean(entree) && typeof entree === 'object' && Number.isFinite(entree.mal_id)
}

/** Construit le contenu du fichier à télécharger. */
export function construireSauvegarde(donnees, maintenant = new Date()) {
  return {
    application: 'anime-ink',
    version: VERSION,
    exporteLe: maintenant.toISOString(),
    favoris: donnees.favoris ?? [],
    liste: donnees.liste ?? [],
    historique: donnees.historique ?? [],
  }
}

/**
 * Relit un fichier de sauvegarde.
 *
 * Le fichier vient de l'extérieur : il peut être tronqué, bricolé, ou n'avoir
 * jamais été une sauvegarde. La lecture ne lève donc jamais — elle rend un
 * verdict, et l'appelant décide.
 *
 * **Rien n'est écrit tant que tout n'est pas valide.** Restaurer à moitié
 * laisserait un état que personne n'a voulu, et dont on ne saurait pas dire
 * s'il vient du fichier ou de la machine.
 *
 * @returns {{ok: true, donnees: object} | {ok: false, raison: string}}
 */
export function lireSauvegarde(texte) {
  let brut
  try {
    brut = JSON.parse(texte)
  } catch {
    return { ok: false, raison: 'Ce fichier n’est pas une sauvegarde Anime-Ink.' }
  }

  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
    return { ok: false, raison: 'Ce fichier n’est pas une sauvegarde Anime-Ink.' }
  }

  if (brut.application !== 'anime-ink') {
    return { ok: false, raison: 'Ce fichier vient d’une autre application.' }
  }

  // Une sauvegarde plus récente que l'application peut porter des champs dont
  // cette version ignore le sens. Mieux vaut le dire que d'en lire la moitié.
  if (!Number.isInteger(brut.version) || brut.version > VERSION) {
    return {
      ok: false,
      raison: 'Cette sauvegarde vient d’une version plus récente du site. Mets-le à jour, puis réessaie.',
    }
  }

  const donnees = {}
  for (const jeu of Object.keys(JEUX)) {
    const valeur = brut[jeu]
    if (valeur === undefined) {
      donnees[jeu] = []
      continue
    }
    if (!Array.isArray(valeur) || !valeur.every(estEntreeValide)) {
      return { ok: false, raison: `La sauvegarde est abîmée : « ${jeu} » n’est pas lisible.` }
    }
    donnees[jeu] = valeur
  }

  return { ok: true, donnees }
}

/** Le nom du fichier proposé au téléchargement. */
export function nomDeFichier(maintenant = new Date()) {
  const jour = maintenant.toISOString().slice(0, 10)
  return `anime-ink-sauvegarde-${jour}.json`
}
