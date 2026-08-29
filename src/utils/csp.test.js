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

  it('laisse la balise plus permissive que l’en-tête, et ce n’est pas un oubli', () => {
    // ⚠️ Les deux politiques DIVERGENT volontairement : l'en-tête interdit tout
    // script inline, la balise doit en autoriser un — le décodeur d'adresses,
    // dont le retour à GitHub Pages que `deploy.yml` garde ouvert dépend.
    //
    // Sans cette vérification, quelqu'un qui « alignerait les deux par
    // cohérence » casserait ce retour sans que rien ne le signale : le défaut
    // ne se verrait que le jour où on en aurait besoin. C'est le travers le
    // plus fréquent de ce dépôt — une garantie tenue à un endroit, perdue par
    // sa copie.
    expect(SOURCE).toMatch(/script-src 'self' 'unsafe-inline'/)
  })
})

describe('la page servie pour une adresse inconnue', () => {
  /**
   * Elle échappait à tout, et il a fallu qu'on la cherche.
   *
   * `404.html` n'est pas transformé comme `index.html` : le plugin qui retire
   * les scripts inline agit sur le document d'entrée, jamais sur un fichier
   * émis à part. Or l'en-tête de sécurité, lui, couvre `/(.*)` — donc cette
   * page aussi. Un script écrit là serait silencieusement bloqué : la page
   * s'afficherait, amputée, et aucune vérification ne la chargeait.
   *
   * Constat au 29 août : elle n'en porte aucun. Ce test fige ce constat plutôt
   * que de le redécouvrir.
   */
  const GABARIT = lire('vite.config.js')

  /**
   * ⚠️ Le repère est vérifié AVANT de découper, et ce n'est pas une précaution
   * de style.
   *
   * `indexOf` rend `-1` quand il ne trouve rien, `slice(-1)` rend alors un seul
   * caractère, le second `indexOf` rend `-1` à son tour et `slice(0, -1)` rend
   * une chaîne **vide** — sur laquelle « ne contient aucun script » est vrai.
   * Déplacer le gabarit dans son propre fichier, ou renommer la clé, ferait
   * donc **passer ce test sans qu'il regarde quoi que ce soit**.
   *
   * Le premier jet du 29 août portait exactement ce défaut, alors même qu'il
   * venait d'être corrigé ailleurs : une garantie tenue à un endroit, perdue
   * par sa copie — encore.
   */
  const REPERE = "fileName: '404.html'"
  const debut = GABARIT.indexOf(REPERE)
  const fin = debut === -1 ? -1 : GABARIT.indexOf('</html>', debut)

  it('est bien trouvée là où ce test la cherche', () => {
    expect(debut, `repère « ${REPERE} » introuvable dans vite.config.js`).toBeGreaterThan(-1)
    expect(fin, 'fin du gabarit introuvable après le repère').toBeGreaterThan(debut)
  })

  it('ne porte aucun script, puisque la politique en bloquerait un', () => {
    expect(GABARIT.slice(debut, fin)).not.toMatch(/<script/)
  })
})
