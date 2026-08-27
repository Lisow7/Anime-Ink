import { describe, expect, it } from 'vitest'
import { urlCanonique } from './useSEO'

/**
 * L'adresse canonique dit aux moteurs quelle URL fait foi. Se tromper ne casse
 * rien à l'écran — c'est bien le problème : le site a annoncé pendant des mois
 * `…/Anime-Ink/Anime-Ink/catalogue`, une adresse qui n'existe pas, sans qu'un
 * seul test ni un seul parcours ne s'en aperçoive.
 *
 * La cause tenait à un `+` : le chemin du navigateur porte déjà le préfixe sous
 * lequel le site est servi, et on le lui ajoutait une seconde fois.
 */
describe('adresse canonique', () => {
  const BASE = '/Anime-Ink/'

  it('n’écrit le préfixe qu’une seule fois', () => {
    // Ce que le navigateur donne réellement sur GitHub Pages.
    const url = urlCanonique('/Anime-Ink/catalogue', BASE)

    expect(url).toBe('https://lisow7.github.io/Anime-Ink/catalogue')
    // L'invariant qui a cédé, figé tel quel : une occurrence, pas deux.
    expect(url.match(/\/Anime-Ink\//g)).toHaveLength(1)
  })

  it('préfixe un chemin qui ne l’a pas', () => {
    // Les ressources déclarées à la racine, comme l'image d'aperçu.
    expect(urlCanonique('/og-image.svg', BASE))
      .toBe('https://lisow7.github.io/Anime-Ink/og-image.svg')
  })

  it('traite l’accueil comme les autres', () => {
    expect(urlCanonique('/Anime-Ink/', BASE)).toBe('https://lisow7.github.io/Anime-Ink/')
    expect(urlCanonique('/Anime-Ink', BASE)).toBe('https://lisow7.github.io/Anime-Ink')
  })

  it('ne préfixe rien quand le site est servi à la racine', () => {
    // Le préfixe se lit dans la configuration de Vite : servi à la racine, il
    // n'y a rien à ajouter, et surtout rien à retirer.
    expect(urlCanonique('/catalogue', '/')).toBe('https://lisow7.github.io/catalogue')
  })

  it('ne confond pas un chemin qui commence par les mêmes lettres', () => {
    // `/Anime-Inkognito` n'est pas sous `/Anime-Ink/` : le préfixe lui manque.
    expect(urlCanonique('/Anime-Inkognito', BASE))
      .toBe('https://lisow7.github.io/Anime-Ink/Anime-Inkognito')
  })
})
