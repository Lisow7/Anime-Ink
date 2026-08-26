import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `ageFilter.test.js` fige la LISTE des genres explicites. Il ne dit rien de la
 * COUVERTURE : une nouvelle surface d'affichage peut oublier le floutage sans
 * qu'aucun test ne bronche — c'est ce qui est arrivé aux suggestions de
 * recherche, servies en clair pendant que la grille floutait la même jaquette.
 *
 * Ce test ferme l'angle mort : tout fichier qui affiche une jaquette d'animé
 * doit classer son contenu, ou figurer ci-dessous avec sa raison.
 */

const RACINE_SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/**
 * Plus aucune surface n'est exemptée : chacune classe ce qu'elle affiche.
 *
 * Une exemption disait « on n'arrive ici que par un clic délibéré ». C'est un
 * raisonnement, pas un mécanisme — et il s'est révélé trop large deux fois :
 * la fiche détail s'atteint aussi par un lien partagé, et la modale affiche des
 * recommandations que personne n'a choisies.
 *
 * Toute nouvelle entrée ici doit être un choix argumenté, pas un oubli constaté.
 */
const EXEMPTIONS = {}

function fichiersJsx(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return fichiersJsx(chemin)
    return entree.name.endsWith('.jsx') ? [chemin] : []
  })
}

describe('couverture du filtre d’âge', () => {
  const surfaces = fichiersJsx(RACINE_SRC)
    .map(chemin => ({ chemin, code: readFileSync(chemin, 'utf8') }))
    // `posterUrl` est le point de passage unique des jaquettes d'animés.
    .filter(({ code }) => code.includes('posterUrl('))
    .map(({ chemin, code }) => ({
      nom: relative(RACINE_SRC, chemin).replace(/\\/g, '/'),
      code,
    }))

  it('trouve bien les surfaces qui affichent une jaquette', () => {
    // Garde-fou du garde-fou : si `posterUrl` était renommé, la liste
    // tomberait à zéro et le test passerait en ne vérifiant plus rien.
    expect(surfaces.length).toBeGreaterThanOrEqual(4)
  })

  it.each(surfaces.map(s => [s.nom, s.code]))('%s classe le contenu adulte, ou est exempté avec sa raison', (nom, code) => {
    if (EXEMPTIONS[nom]) {
      expect(EXEMPTIONS[nom].length).toBeGreaterThan(20)
      return
    }
    expect(
      code.includes('classifyAdultContent'),
      `${nom} affiche une jaquette sans classer son contenu. Soit il applique `
      + 'classifyAdultContent, soit il rejoint EXEMPTIONS avec la raison qui le justifie.',
    ).toBe(true)
  })

  it('n’exempte que des fichiers qui existent encore', () => {
    const noms = surfaces.map(s => s.nom)
    for (const exempte of Object.keys(EXEMPTIONS)) {
      expect(noms, `${exempte} est exempté mais n’affiche plus de jaquette`).toContain(exempte)
    }
  })
})
