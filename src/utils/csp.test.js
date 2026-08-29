import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * La politique de sécurité de contenu, et ce qui la rend vérifiable.
 *
 * ## Pourquoi ces vérifications existent
 *
 * Une politique de sécurité n'échoue jamais bruyamment. Trop permissive, tout
 * fonctionne et la protection est absente ; trop stricte, un pan de la page
 * cesse de s'afficher **sans que rien ne casse au build**. Dans les deux cas, le
 * défaut ne se voit qu'en production, et seulement si quelqu'un regarde.
 *
 * Ces vérifications lisent donc `vercel.json`, servi tel quel, plutôt qu'une
 * copie. Elles tournent avec les autres tests, donc à chaque intégration.
 *
 * ## Le point qu'elles gardent vraiment
 *
 * `script-src` a longtemps porté `'unsafe-inline'`, ce qui annule l'essentiel
 * de la protection : n'importe quel script injecté dans la page devient
 * exécutable. Un seul élément l'exigeait — le décodeur d'adresses de GitHub
 * Pages — et le build servi par Vercel ne le contient plus.
 *
 * Le retour de `'unsafe-inline'` serait un recul silencieux : rien ne
 * s'afficherait différemment. D'où une vérification qui le refuse nommément.
 */

const RACINE = new URL('../../', import.meta.url)
const lire = chemin => readFileSync(fileURLToPath(new URL(chemin, RACINE)), 'utf8')

const CONFIG = JSON.parse(lire('vercel.json'))

const POLITIQUE = CONFIG.headers
  ?.flatMap(bloc => bloc.headers)
  .find(entete => entete.key === 'Content-Security-Policy')
  ?.value

/** `default-src 'self'` → `{ 'default-src': ["'self'"] }`. */
const DIRECTIVES = Object.fromEntries(
  (POLITIQUE ?? '').split(';').map(part => part.trim()).filter(Boolean)
    .map(part => { const [nom, ...valeurs] = part.split(/\s+/); return [nom, valeurs] }),
)

describe('politique de sécurité de contenu', () => {
  it('est servie en en-tête, et non par une balise', () => {
    // Une balise `<meta>` ignore `frame-ancestors`, `report-uri` et
    // `report-to` : la politique y serait amputée sans le dire. C'est ce qui
    // obligeait à servir `frame-ancestors` séparément, et faisait cohabiter
    // deux politiques dont chaque modification devait être pensée deux fois.
    expect(POLITIQUE, 'aucun en-tête Content-Security-Policy dans vercel.json').toBeTruthy()
  })

  it('n’autorise aucun script inline', () => {
    // ⚠️ La vérification centrale de ce fichier. Voir l'en-tête.
    expect(DIRECTIVES['script-src']).toEqual(["'self'"])
  })

  it('garde les styles inline, et pour une raison précise', () => {
    // `inlineCssPlugin` remplace la feuille de style par un bloc `<style>` pour
    // épargner une requête au démarrage, et React pose des styles calculés —
    // le floutage des jaquettes réservées à un public averti en dépend.
    // Ce n'est donc pas un oubli, et le retirer casserait l'affichage.
    expect(DIRECTIVES['style-src']).toContain("'unsafe-inline'")
  })

  it('interdit ce qui n’a aucune raison d’être permis', () => {
    expect(DIRECTIVES['default-src']).toEqual(["'self'"])
    expect(DIRECTIVES['object-src']).toEqual(["'none'"])
    expect(DIRECTIVES['base-uri']).toEqual(["'none'"])
    // Servi en en-tête, `frame-ancestors` protège enfin depuis la même
    // politique que le reste plutôt que depuis une seconde, posée à côté.
    expect(DIRECTIVES['frame-ancestors']).toEqual(["'none'"])
  })

  it('n’ouvre le réseau qu’aux hôtes dont le site a besoin', () => {
    // AniList sert les données ; MyMemory traduit les synopsis dans la modale.
    expect(DIRECTIVES['connect-src']).toEqual([
      "'self'", 'https://graphql.anilist.co', 'https://api.mymemory.translated.net',
    ])
  })

  it('garde l’hôte des jaquettes enregistrées avant la bascule', () => {
    // ⚠️ `cdn.myanimelist.net` n'est PAS un résidu de l'ancienne source : les
    // favoris et la liste de suivi gardent sur l'appareil des adresses qui y
    // pointent, et qui s'affichent encore. Le retirer viderait les jaquettes
    // des visiteurs les plus anciens — précisément ceux qu'on tient à garder.
    expect(DIRECTIVES['img-src']).toContain('https://cdn.myanimelist.net')
    expect(DIRECTIVES['img-src']).toContain('https://s4.anilist.co')
  })
})

describe('la page servie par Vercel se passe de script inline', () => {
  const SOURCE = lire('index.html')

  it('ne porte qu’un seul script inline, et il se déclare', () => {
    // Le plugin retire ce script par son attribut plutôt qu'en devinant sa
    // forme. En introduire un second sans attribut le laisserait dans le build
    // servi, où la politique le bloquerait — la page se chargerait, amputée.
    const inlines = SOURCE.match(/<script(?![^>]*\bsrc=)[^>]*>/g) ?? []
    const executables = inlines.filter(balise => !/type="application\/ld\+json"/.test(balise))

    expect(executables).toEqual(['<script data-hote="github-pages">'])
  })

  it('garde la balise de politique pour l’hébergement qui n’a pas d’en-tête', () => {
    // Hors Vercel, un hébergement de fichiers statiques ne sait pas émettre
    // d'en-tête : la balise y est la seule politique possible. Le plugin la
    // retire du build de Vercel, où elle ferait doublon.
    expect(SOURCE).toMatch(/<meta http-equiv="Content-Security-Policy"/)
  })
})
