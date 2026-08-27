import { describe, expect, it, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LARGEURS, optimiser, posterUrl } from './images'

/**
 * L'optimiseur d'images de l'hébergement, et son contrat avec `vercel.json`.
 *
 * Le piège de ce dispositif n'est pas le code : c'est que **deux fichiers
 * doivent s'accorder**. Une largeur demandée par le code mais absente de
 * `vercel.json` ne dégrade pas l'image, elle fait répondre une erreur — et
 * comme rien n'exécute cette configuration en local, la divergence ne se
 * verrait qu'en production, sur toutes les jaquettes à la fois.
 */

const CONFIG = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8'),
)

describe('accord entre le code et la configuration de l’hébergement', () => {
  it('demande exactement les largeurs que l’hébergement produit', () => {
    expect(CONFIG.images.sizes).toEqual(LARGEURS)
  })

  it('demande une qualité que l’hébergement autorise', () => {
    // La qualité est figée dans le code ; l'hébergement refuse tout ce qui ne
    // figure pas dans sa liste.
    const url = optimiserAvecHote('https://s4.anilist.co/x.png')
    const q = Number(new URLSearchParams(url.split('?')[1]).get('q'))
    expect(CONFIG.images.qualities).toContain(q)
  })

  it('n’autorise que les domaines dont le site affiche réellement des images', () => {
    const hotes = CONFIG.images.remotePatterns.map(p => p.hostname)
    // AniList sert les jaquettes d'aujourd'hui ; MyAnimeList celles que les
    // favoris et la liste de suivi ont enregistrées avant la bascule, et qui
    // s'affichent encore.
    expect(hotes).toContain('s4.anilist.co')
    expect(hotes).toContain('cdn.myanimelist.net')
  })

  it('réécrit chaque route de l’application, et elles seules', () => {
    // Les routes sont lues dans le code plutôt que recopiées : en ajouter une
    // sans l'inscrire ici la ferait répondre `404` en production, alors même
    // qu'elle marche en développement.
    const app = readFileSync(fileURLToPath(new URL('../App.jsx', import.meta.url)), 'utf8')
    const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)]
      .map(m => m[1])
      .filter(chemin => chemin !== '*' && chemin !== '/')          // l'accueil est un fichier, pas une réécriture
      .map(chemin => chemin.replace(/:(\w+)/g, ':$1'))

    const reecrites = CONFIG.rewrites.map(r => r.source)
    routes.forEach(route => {
      expect(reecrites, `la route ${route} n'est pas réécrite : elle répondra 404 en production`).toContain(route)
    })
  })

  it('ne réécrit pas tout et n’importe quoi', () => {
    // Une réécriture attrape-tout rendrait `200` sur **toute** adresse, y
    // compris inventée : le « soft 404 » que la documentation déconseille, et
    // le symétrique exact du défaut qu'on répare.
    const attrapeTout = CONFIG.rewrites.filter(r => /^\/\(?\.\*\)?/.test(r.source))
    expect(attrapeTout).toEqual([])
    // Un `redirects` ferait un détour visible et garderait le défaut.
    expect(CONFIG.redirects).toBeUndefined()
  })

  it('pose les protections que la balise `meta` ne peut pas porter', () => {
    const poses = CONFIG.headers[0].headers.map(h => h.key)
    expect(poses).toContain('Content-Security-Policy')
    expect(poses).toContain('Permissions-Policy')
    // `frame-ancestors` est la seule directive qu'une balise ignore et qui ait
    // une conséquence concrète ici.
    const csp = CONFIG.headers[0].headers.find(h => h.key === 'Content-Security-Policy')
    expect(csp.value).toContain('frame-ancestors')
  })
})

/** Force l'optimiseur actif, quel que soit l'hôte qui exécute les tests. */
function optimiserAvecHote(url, largeur) {
  vi.stubGlobal('__OPTIMISE_IMAGES__', true)
  return optimiser(url, largeur)
}

describe('optimiseur d’images', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('laisse l’adresse intacte là où l’optimiseur n’existe pas', () => {
    vi.stubGlobal('__OPTIMISE_IMAGES__', false)
    const url = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.png'

    // GitHub Pages ne transforme rien : le site doit rester correct, seulement
    // plus lourd. Une adresse `/_vercel/image` y donnerait une image cassée.
    expect(optimiser(url)).toBe(url)
    expect(posterUrl({ webp: { image_url: url } })).toBe(url)
  })

  it('enveloppe l’adresse quand l’optimiseur existe', () => {
    const source = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1.png'
    const url = optimiserAvecHote(source)

    expect(url.startsWith('/_vercel/image?')).toBe(true)
    // L'adresse d'origine doit être encodée : ses `?` et `&` couperaient
    // sinon la requête en deux.
    expect(new URLSearchParams(url.split('?')[1]).get('url')).toBe(source)
  })

  it('n’enveloppe jamais deux fois', () => {
    const deja = '/_vercel/image?url=x&w=256&q=70'
    expect(optimiserAvecHote(deja)).toBe(deja)
  })

  it('retombe sur une largeur connue plutôt que d’en inventer une', () => {
    // Une largeur hors liste fait répondre une erreur, pas une image plus
    // grande : mieux vaut la ramener dans la liste que la transmettre.
    const url = optimiserAvecHote('https://s4.anilist.co/x.png', 9999)
    expect(Number(new URLSearchParams(url.split('?')[1]).get('w'))).toBe(LARGEURS[0])
  })

  it('ne fabrique pas d’adresse à partir de rien', () => {
    expect(optimiserAvecHote(undefined)).toBeUndefined()
    expect(posterUrl(null)).toBeUndefined()
  })
})
