/**
 * Budget de poids : empêche une régression silencieuse du bundle.
 *
 * La performance a coûté cher — Lighthouse de 85 à 100, LCP de 3,9 s à 1,7 s,
 * obtenus en découpant le bundle et en n'appelant `@dnd-kit` que pour l'onglet
 * « Ma liste ». Rien n'empêchait jusqu'ici de le reperdre : un import mal placé
 * ramène une bibliothèque entière dans le chunk d'entrée sans qu'aucun contrôle
 * ne bronche, et la CI reste verte.
 *
 * Les tailles sont mesurées **en gzip**, seule unité qui compte pour ce que le
 * visiteur télécharge.
 *
 * Les plafonds sont volontairement serrés — environ 10 % au-dessus du mesuré.
 * Un budget large ne refuse rien et donne une fausse assurance ; quand une
 * hausse est légitime, on relève le plafond dans le même commit, ce qui laisse
 * une trace de la décision.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { gzipSync } from 'node:zlib'

const ASSETS = 'dist/assets'

/**
 * Mesuré au 28 août 2026 : 104,3 ko au démarrage, 145,8 ko au total.
 *
 * Les marges sont de l'ordre de 3 %, et ce n'est pas de la coquetterie : un
 * premier réglage à 10 % laissait passer, sans un mot, le retour d'une route
 * entière dans le chunk d'entrée — +4,6 ko, la régression même que ce budget
 * doit refuser. Un plafond se règle sur ce qu'on veut attraper, pas sur une
 * fraction confortable du mesuré.
 *
 * Relevé de 104 à 105 ko le 27 août : le mesuré était monté à 103,9, soit 0,1 ko
 * de marge — un cliquet qui refuse le prochain octet ne protège plus, il bloque.
 *
 * 105 et non 107, et l'écart n'est pas un détail : à 107, la mutation de
 * référence — une route entière remise dans le chunk d'entrée, mesurée à
 * 105,6 ko — **passait sans un mot**. C'est la régression même que ce budget
 * existe pour refuser, et relâcher le plafond « pour se donner de l'air »
 * l'aurait rendue invisible une seconde fois.
 *
 * La règle, donc : **le plafond se règle sur la plus petite régression qu'on
 * veut attraper**, jamais sur une fraction confortable du mesuré. Et il ne se
 * relève qu'avec la mesure qui le justifie, dans le commit qui l'accompagne.
 *
 * ## Les deux plafonds ne font pas le même travail
 *
 * Le **démarrage** est le garde-fou strict : il mesure ce que télécharge
 * *chaque* visiteur, et cette quantité n'a aucune raison de croître avec les
 * fonctionnalités — une page ajoutée est chargée à la demande. Une hausse y est
 * donc suspecte par nature, et sa marge reste étroite.
 *
 * Le **total** mesure la somme, y compris ce que peu de gens chargent. Il croît
 * légitimement à chaque écran ajouté : un plafond fixe sur une valeur qui monte
 * est condamné à devenir soit inutile, soit bloquant. Son rôle est d'attraper
 * une dérive d'ensemble — une dépendance conséquente, une police, une image
 * embarquée — et il se relève quand un lot le justifie, avec sa mesure.
 *
 * Relevé de 146 à 148 ko le 28 août : « Tes goûts » portait le mesuré à
 * 145,8 ko, soit 0,2 ko de marge. Une dépendance légère importée en dur — +0,8
 * ko, mesuré — n'y sera plus attrapée ; si elle entre au **démarrage**, en
 * revanche, le plafond de 105 ko l'arrête, et c'est là que ça compte.
 */
const PLAFONDS = {
  demarrage: 105 * 1024,
  total: 148 * 1024,
}

const gz = chemin => gzipSync(readFileSync(chemin)).length
const ko = octets => (octets / 1024).toFixed(1)

if (!existsSync(ASSETS)) {
  console.error(`Budget : ${ASSETS} est introuvable — lancer \`npm run build\` d'abord.`)
  process.exit(1)
}

const html = readFileSync('dist/index.html', 'utf8')

/**
 * Ce que le document réclame lui-même, plus les feuilles de style.
 *
 * Le CSS n'apparaît dans aucun `href` : il est chargé par le module d'entrée.
 * L'omettre sous-estimerait le démarrage de 9 ko, alors qu'il est indispensable
 * au premier rendu.
 */
const referencesHtml = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)]
  .map(m => basename(m[1]))

const fichiers = readdirSync(ASSETS).filter(f => /\.(js|css)$/.test(f))
const feuillesDeStyle = fichiers.filter(f => f.endsWith('.css'))
const auDemarrage = [...new Set([...referencesHtml, ...feuillesDeStyle])]

if (referencesHtml.length === 0) {
  console.error(
    'Budget : aucun script référencé par `dist/index.html`. Le calcul porterait ' +
    'sur une liste vide et passerait en ne vérifiant rien.',
  )
  process.exit(1)
}

let demarrage = 0
console.log('Au démarrage')
for (const nom of auDemarrage.sort()) {
  const chemin = join(ASSETS, nom)
  if (!existsSync(chemin)) continue
  const taille = gz(chemin)
  demarrage += taille
  console.log(`  ${ko(taille).padStart(7)} ko   ${nom}`)
}

const total = fichiers.reduce((somme, f) => somme + gz(join(ASSETS, f)), 0)

console.log('')
const lignes = [
  ['Démarrage', demarrage, PLAFONDS.demarrage],
  ['Total', total, PLAFONDS.total],
]

let depassement = false
for (const [nom, mesure, plafond] of lignes) {
  const marge = plafond - mesure
  const verdict = marge >= 0 ? 'ok   ' : 'DÉPASSÉ'
  console.log(
    `  ${verdict} ${nom.padEnd(10)} ${ko(mesure).padStart(7)} ko  ` +
    `/ ${ko(plafond)} ko  (${marge >= 0 ? 'reste' : 'excès de'} ${ko(Math.abs(marge))} ko)`,
  )
  if (marge < 0) depassement = true
}

console.log(`\n${fichiers.length} actifs mesurés en gzip.`)
if (depassement) {
  console.log(
    'Budget : dépassé. Si la hausse est justifiée, relever le plafond dans ' +
    '`scripts/budget.mjs` — dans le même commit, pour que la décision se voie.',
  )
  process.exit(1)
}
console.log('Budget : tenu.')
