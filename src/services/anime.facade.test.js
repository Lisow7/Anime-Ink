import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as facade from './anime'

/**
 * La façade n'expose que ce dont les écrans se servent.
 *
 * Une porte d'entrée qui offre plus que nécessaire oblige chaque lecteur à se
 * demander qui utilise quoi — et rien ne signale qu'une fonction a perdu son
 * dernier appelant. Le retrait de l'ancienne source a laissé trois exports dans
 * ce cas ; sans ce garde-fou, le suivant passerait tout aussi inaperçu.
 *
 * Ce que ce test **ne** fait pas : juger le code des services entre eux. Les
 * modules internes s'appellent librement. Seule la frontière entre les données
 * et les écrans est tenue.
 */

const RACINE = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Là où vivent les écrans : tout ce qui n'est ni service ni test. */
const CONSOMMATEURS = ['components', 'pages', 'context', 'hooks', 'utils']

function fichiers(dossier) {
  let trouves = []
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) trouves = trouves.concat(fichiers(chemin))
    else if (/\.(js|jsx)$/.test(entree.name) && !entree.name.includes('.test.')) trouves.push(chemin)
  }
  return trouves
}

const CODE_DES_ECRANS = CONSOMMATEURS
  .flatMap(d => fichiers(join(RACINE, d)))
  .map(chemin => ({ nom: relative(RACINE, chemin).replace(/\\/g, '/'), code: readFileSync(chemin, 'utf8') }))

describe('façade des données', () => {
  it('trouve bien le code des écrans', () => {
    // Garde-fou du garde-fou : un dossier renommé viderait la liste, et chaque
    // export passerait alors pour inutilisé — ou pour utilisé, selon le sens du
    // test. Mieux vaut s'en apercevoir ici.
    expect(CODE_DES_ECRANS.length).toBeGreaterThan(10)
  })

  it.each(Object.keys(facade).sort())('l’export « %s » a au moins un appelant', (nom) => {
    const appelants = CODE_DES_ECRANS.filter(({ code }) =>
      new RegExp(`\\b${nom}\\b`).test(code),
    )

    expect(
      appelants.length,
      `\`${nom}\` n'est utilisé par aucun écran. Soit un appelant a disparu et `
      + 'l\'export doit suivre, soit il n\'a jamais servi — dans les deux cas, il '
      + 'reste accessible depuis son module sans encombrer la façade.',
    ).toBeGreaterThan(0)
  })
})
