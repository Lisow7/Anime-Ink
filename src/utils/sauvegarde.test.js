import { describe, expect, it } from 'vitest'
import { construireSauvegarde, fusionner, lireSauvegarde, nomDeFichier, VERSION } from './sauvegarde'

/**
 * La sauvegarde est le seul filet sous des données qui n'existent que dans un
 * navigateur. Deux exigences la gouvernent, et les deux se testent ici :
 * un fichier venu de l'extérieur ne doit jamais abîmer ce qui est en place, et
 * une restauration ne doit jamais faire reculer une progression.
 */

const FICHIER = JSON.stringify(construireSauvegarde({
  favoris: [{ mal_id: 1, title: 'Cowboy Bebop' }],
  liste: [{ mal_id: 2, title: 'Frieren', currentEpisode: 3 }],
  historique: [{ mal_id: 3, title: 'Monster' }],
}))

describe('construction de la sauvegarde', () => {
  it('porte de quoi se reconnaître et se dater', () => {
    const s = construireSauvegarde({}, new Date('2026-08-28T10:00:00Z'))

    // Sans ces deux champs, un fichier ne peut ni être distingué d'un autre
    // JSON, ni être relu par une version future qui aurait changé de forme.
    expect(s.application).toBe('anime-ink')
    expect(s.version).toBe(VERSION)
    expect(s.exporteLe).toBe('2026-08-28T10:00:00.000Z')
  })

  it('n’emporte jamais le consentement ni les caches', () => {
    const s = construireSauvegarde({
      favoris: [], liste: [], historique: [],
      // Ce qu'un appelant distrait pourrait lui passer.
      'anime-ink-cookie-consent': { userdata: true },
      cache: { tout: 'ça' },
    })

    // Restaurer un consentement fabriquerait un accord que la personne n'a pas
    // donné sur cette machine. Il doit être redemandé.
    expect(JSON.stringify(s)).not.toMatch(/consent/i)
    expect(JSON.stringify(s)).not.toMatch(/cache/i)
  })

  it('rend des listes vides plutôt que rien', () => {
    const s = construireSauvegarde({})
    expect(s.favoris).toEqual([])
    expect(s.liste).toEqual([])
    expect(s.historique).toEqual([])
  })

  it('nomme le fichier par sa date', () => {
    expect(nomDeFichier(new Date('2026-08-28T22:30:00Z'))).toBe('anime-ink-sauvegarde-2026-08-28.json')
  })
})

describe('lecture d’une sauvegarde', () => {
  it('relit ce qu’elle a écrit', () => {
    const verdict = lireSauvegarde(FICHIER)

    expect(verdict.ok).toBe(true)
    expect(verdict.donnees.favoris).toHaveLength(1)
    expect(verdict.donnees.liste[0].currentEpisode).toBe(3)
  })

  it.each([
    ['du texte qui n’est pas du JSON', 'ceci n’est pas un fichier'],
    ['un JSON qui n’est pas un objet', '[1, 2, 3]'],
    ['le mot null', 'null'],
    ['un objet vide', '{}'],
    ['une sauvegarde d’une autre application', '{"application":"autre-chose","version":1}'],
  ])('refuse %s', (_cas, contenu) => {
    // Le fichier est choisi par la personne : il peut être n'importe quoi. La
    // lecture rend un verdict, elle ne lève jamais.
    expect(lireSauvegarde(contenu).ok).toBe(false)
  })

  it('refuse une sauvegarde plus récente que l’application', () => {
    const futur = JSON.stringify({ application: 'anime-ink', version: VERSION + 1, favoris: [] })
    const verdict = lireSauvegarde(futur)

    // Elle peut porter des champs dont cette version ignore le sens : en lire
    // la moitié serait pire que de refuser.
    expect(verdict.ok).toBe(false)
    expect(verdict.raison).toMatch(/plus récente/)
  })

  it('refuse le tout si une seule liste est abîmée', () => {
    const abime = JSON.stringify({
      application: 'anime-ink', version: VERSION,
      favoris: [{ mal_id: 1 }],
      liste: [{ pas_d_identifiant: true }],
    })
    const verdict = lireSauvegarde(abime)

    // Restaurer à moitié laisserait un état que personne n'a voulu, et dont on
    // ne saurait dire ce qui vient du fichier et ce qui vient de la machine.
    expect(verdict.ok).toBe(false)
    expect(verdict.raison).toMatch(/liste/)
  })

  it('accepte une entrée réduite à son identifiant', () => {
    // Les entrées enregistrées de longue date peuvent avoir perdu leur
    // jaquette ou n'avoir jamais porté de synopsis. Être plus strict que
    // l'application reviendrait à jeter des données qu'elle sait afficher.
    const minimal = JSON.stringify({ application: 'anime-ink', version: VERSION, favoris: [{ mal_id: 7 }] })
    expect(lireSauvegarde(minimal).ok).toBe(true)
  })

  it('tolère une sauvegarde partielle', () => {
    const partiel = JSON.stringify({ application: 'anime-ink', version: VERSION, favoris: [{ mal_id: 1 }] })
    const verdict = lireSauvegarde(partiel)

    expect(verdict.ok).toBe(true)
    expect(verdict.donnees.liste).toEqual([])
  })
})

describe('fusion', () => {
  it('ne fait jamais reculer une progression', () => {
    const local = [{ mal_id: 2, currentEpisode: 12 }]
    const fichier = [{ mal_id: 2, currentEpisode: 3 }]

    // C'est l'exigence centrale, et elle tient à l'ordre : le dédoublonnage
    // garde la PREMIÈRE occurrence. Inverser ces deux tableaux ferait perdre
    // neuf épisodes de progression, en silence.
    expect(fusionner(local, fichier)).toEqual([{ mal_id: 2, currentEpisode: 12 }])
  })

  it('ajoute ce qui manque', () => {
    const fusion = fusionner([{ mal_id: 1 }], [{ mal_id: 1 }, { mal_id: 5 }])

    expect(fusion.map(e => e.mal_id)).toEqual([1, 5])
  })

  it('supporte des listes absentes', () => {
    expect(fusionner(undefined, [{ mal_id: 1 }])).toEqual([{ mal_id: 1 }])
    expect(fusionner([{ mal_id: 1 }], undefined)).toEqual([{ mal_id: 1 }])
  })
})
