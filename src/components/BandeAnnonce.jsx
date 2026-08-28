import { useState } from 'react'
import { safeYoutubeEmbed } from '../utils/urls'

/**
 * La bande-annonce, chargée seulement si on la demande.
 *
 * Une `iframe` YouTube posée dans la page charge le lecteur **en entier dès
 * l'ouverture**, que le visiteur la regarde ou non. Mesuré le 28 août 2026 sur
 * une fiche en production : **4,1 Mo sur 4,6** venaient de là — le script du
 * lecteur, sa feuille de style, ses dépendances. Et son insertion tardive
 * décalait la mise en page d'un CLS de 0,45, quand le seuil acceptable est
 * 0,1.
 *
 * D'où cette façade : une image, un bouton, et l'`iframe` seulement au clic.
 * C'est un motif éprouvé — la vignette vient de YouTube, donc rien n'est
 * inventé, et le lecteur démarre tout seul puisque le clic vaut intention.
 *
 * Le cadre garde ses proportions dès le départ : c'est ce qui empêche la page
 * de sauter au moment où le lecteur prend sa place.
 */
export default function BandeAnnonce({ embedUrl, youtubeId, titre }) {
  const [demandee, setDemandee] = useState(false)
  const source = safeYoutubeEmbed(embedUrl)
  if (!source) return null

  // `hqdefault` existe pour toutes les vidéos, là où les définitions
  // supérieures manquent sur les plus anciennes et laisseraient un cadre vide.
  const vignette = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)] relative">
      {demandee ? (
        <iframe
          // `autoplay` : on n'arrive ici qu'après un clic, et laisser
          // l'utilisateur cliquer une seconde fois serait le punir d'avoir
          // demandé.
          src={`${source}${source.includes('?') ? '&' : '?'}autoplay=1`}
          title={`Bande-annonce — ${titre}`}
          className="w-full h-full"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button
          onClick={() => setDemandee(true)}
          className="group w-full h-full relative flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e]"
          aria-label={`Lire la bande-annonce de ${titre}`}
        >
          {vignette && (
            <img
              src={vignette}
              alt=""
              aria-hidden="true"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Un voile assombri : la pastille de lecture doit rester lisible
              quelle que soit la vignette, qui peut être claire. */}
          <span className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors" />
          <span className="relative bg-red-600 group-hover:bg-red-500 transition-colors rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white fill-current ml-1" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  )
}
