import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { imagesDepuisAniList } from '../services/anilist/traduction'
import { posterUrl } from './images'

/**
 * La grande jaquette est réservée aux aperçus sociaux, jamais à l'écran.
 *
 * Le budget de poids ne mesure que les fichiers du site : les images viennent
 * d'un domaine tiers et lui échappent entièrement. Une régression de ce
 * côté-là est donc **invisible** à tout ce que la CI vérifie — celle-ci est
 * passée entre les mailles jusqu'à la production, où une fiche téléchargeait
 * 478 ko pour un emplacement de 192 pixels.
 *
 * Mesuré le 27 août 2026 sur `Media(idMal: 1)` :
 *
 * | taille AniList | dimensions | poids   |
 * |----------------|------------|---------|
 * | `medium`       | 100 × 139  |  29 ko  |
 * | `large`        | 230 × 320  | 137 ko  |
 * | `extraLarge`   | 460 × 640  | 478 ko  |
 *
 * Aucun emplacement n'excède 192 pixels : la taille moyenne les sert tous.
 * `extraLarge` reste dans `large_image_url` pour la seule métadonnée
 * `og:image`, où le poids ne coûte rien — le robot la charge une fois — et où
 * descendre sous 300 pixels de large ferait échouer la carte
 * `summary_large_image` de X, dont c'est le minimum documenté.
 */

const RACINE_SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Une exemption doit nommer l'emplacement et pourquoi il lui faut la grande. */
const EXEMPTIONS = {}

function fichiersJsx(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap(entree => {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) return fichiersJsx(chemin)
    return entree.name.endsWith('.jsx') ? [chemin] : []
  })
}

describe('poids des jaquettes', () => {
  const surfaces = fichiersJsx(RACINE_SRC)
    .map(chemin => ({ chemin, code: readFileSync(chemin, 'utf8') }))
    .filter(({ code }) => code.includes('posterUrl('))
    .map(({ chemin, code }) => ({ nom: relative(RACINE_SRC, chemin).replace(/\\/g, '/'), code }))

  it('trouve bien les surfaces qui affichent une jaquette', () => {
    // Garde-fou du garde-fou : `posterUrl` renommé, la liste tomberait à zéro
    // et ce test passerait en ne vérifiant plus rien.
    expect(surfaces.length).toBeGreaterThanOrEqual(4)
  })

  it.each(surfaces.map(s => [s.nom, s.code]))('%s n’affiche pas la grande jaquette', (nom, code) => {
    if (EXEMPTIONS[nom]) {
      expect(EXEMPTIONS[nom].length).toBeGreaterThan(20)
      return
    }
    expect(
      /posterUrl\([^)]*large:\s*true/.test(code),
      `${nom} demande la grande jaquette pour un affichage. Elle pèse 478 ko contre `
      + '137 ko pour la moyenne, qui couvre tous les emplacements du site — le plus '
      + 'large fait 192 pixels. Soit il prend la moyenne, soit il rejoint EXEMPTIONS '
      + 'avec la raison qui le justifie.',
    ).toBe(false)
  })

  it('n’exempte que des fichiers qui affichent encore une jaquette', () => {
    const noms = surfaces.map(s => s.nom)
    for (const exempte of Object.keys(EXEMPTIONS)) {
      expect(noms, `${exempte} est exempté mais n’affiche plus de jaquette`).toContain(exempte)
    }
  })

  it('sert la taille moyenne à l’écran et garde la grande pour l’aperçu social', () => {
    const images = imagesDepuisAniList({
      medium: 'https://s4.anilist.co/…/cover/small/bx1.png',
      large: 'https://s4.anilist.co/…/cover/medium/bx1.png',
      extraLarge: 'https://s4.anilist.co/…/cover/large/bx1.png',
    })

    // Ce que voit le visiteur.
    expect(posterUrl(images)).toContain('/cover/medium/')
    // Ce que lisent les robots sociaux, et eux seuls.
    expect(images.jpg.large_image_url).toContain('/cover/large/')
  })
})
