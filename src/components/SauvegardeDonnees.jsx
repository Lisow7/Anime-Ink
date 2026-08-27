import { useRef, useState } from 'react'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { useCookieConsent } from '../context/CookieContext'
import { construireSauvegarde, lireSauvegarde, nomDeFichier } from '../utils/sauvegarde'

/**
 * Emporter ses données, et les retrouver.
 *
 * Le site n'a ni compte ni serveur : tout ce que le visiteur constitue vit dans
 * son navigateur. C'est ce qui lui évite de confier quoi que ce soit à qui que
 * ce soit — au prix d'un risque sans recours jusqu'ici : un « effacer les
 * données du site », un changement de machine, et tout disparaît.
 *
 * Deux garde-fous encadrent la restauration :
 *   - elle **complète** sans jamais remplacer, donc importer une vieille
 *     sauvegarde ne peut pas faire reculer ce qui a été fait depuis ;
 *   - elle est refusée tant que le stockage local n'est pas accepté. Sans ce
 *     garde, les données seraient écrites puis ignorées par l'application, et
 *     le prochain refus de consentement les effacerait.
 */
export default function SauvegardeDonnees() {
  const { favorites, importer: importerFavoris } = useFavorites()
  const { watchlist, importer: importerListe } = useWatchlist()
  const { history, importer: importerHistorique } = useHistory()
  const { consent } = useCookieConsent()
  const champFichier = useRef(null)
  const [message, setMessage] = useState(null)

  const stockageAccepte = consent?.userdata === true
  const total = favorites.length + watchlist.length + history.length

  function telecharger() {
    const contenu = construireSauvegarde({
      favoris: favorites,
      liste: watchlist,
      historique: history,
    })

    // Le fichier est fabriqué dans le navigateur et n'est envoyé nulle part :
    // c'est la même promesse que le reste du site.
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' }),
    )
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nomDeFichier()
    lien.click()
    URL.revokeObjectURL(url)

    setMessage({ ton: 'ok', texte: `Sauvegarde de ${total} entrée${total > 1 ? 's' : ''} téléchargée.` })
  }

  async function restaurer(evenement) {
    const fichier = evenement.target.files?.[0]
    // Le champ est remis à zéro tout de suite : sans cela, rouvrir le même
    // fichier après une correction ne déclencherait rien.
    evenement.target.value = ''
    if (!fichier) return

    const verdict = lireSauvegarde(await fichier.text())
    if (!verdict.ok) {
      setMessage({ ton: 'erreur', texte: verdict.raison })
      return
    }

    const ajoutes = importerFavoris(verdict.donnees.favoris)
      + importerListe(verdict.donnees.liste)
      + importerHistorique(verdict.donnees.historique)

    setMessage({
      ton: 'ok',
      texte: ajoutes > 0
        ? `${ajoutes} entrée${ajoutes > 1 ? 's' : ''} restaurée${ajoutes > 1 ? 's' : ''}.`
        : 'Tout ce que contient cette sauvegarde est déjà là.',
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[var(--text-primary)] font-semibold text-lg">Tes données</h2>

      <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-3">
        <p className="text-[var(--text-muted)] text-sm leading-relaxed">
          Tes favoris, ta liste et ton historique vivent dans ce navigateur, et nulle part ailleurs.
          Télécharge-les pour les garder à l’abri d’un nettoyage, ou les emporter sur un autre appareil.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={telecharger}
            disabled={total === 0}
            className="px-4 py-2 bg-[#15803d] hover:bg-[#166534] disabled:bg-[var(--bg-elevated)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Télécharger mes données
          </button>

          <button
            onClick={() => champFichier.current?.click()}
            disabled={!stockageAccepte}
            className="px-4 py-2 border border-[var(--border-color)] hover:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-semibold rounded-lg transition-colors"
          >
            Restaurer une sauvegarde
          </button>

          <input
            ref={champFichier}
            type="file"
            accept="application/json,.json"
            onChange={restaurer}
            className="sr-only"
            aria-label="Choisir un fichier de sauvegarde"
          />
        </div>

        {!stockageAccepte && (
          <p className="text-[var(--text-muted)] text-xs">
            La restauration a besoin de ton accord pour le stockage local — sans lui, les données
            seraient écrites puis aussitôt ignorées.
          </p>
        )}

        {/* Le résultat est annoncé aux lecteurs d'écran : un message qui
            n'apparaît que visuellement laisserait sans réponse ceux qui
            viennent de déclencher l'action. */}
        <p
          role="status"
          aria-live="polite"
          className={`text-xs ${message?.ton === 'erreur' ? 'text-[#f87171]' : 'text-[var(--text-muted)]'}`}
        >
          {message?.texte ?? ''}
        </p>
      </div>
    </section>
  )
}
