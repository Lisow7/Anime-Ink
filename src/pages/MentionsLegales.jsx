import { Link } from 'react-router-dom'
import { useSEO } from '../hooks/useSEO'
import { useCookieConsent } from '../context/CookieContext'

export default function MentionsLegales() {
  useSEO({ title: 'Mentions légales', description: 'Mentions légales du site Anime-Ink : éditeur, données personnelles, RGPD, gestion des cookies et propriété intellectuelle.' })
  const { consent, openSettings } = useCookieConsent()

  const consentDate = consent?.decidedAt
    ? new Date(consent.decidedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-10">

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">Mentions légales</h1>
        <p className="text-[var(--text-muted)] text-sm">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <Section title="Éditeur du site">
        <p>
          Le site <strong>Anime-Ink</strong> est un projet personnel à but non commercial, développé et maintenu par un développeur indépendant.
        </p>
        <p>Contact : <a href="mailto:lisow33@gmail.com" className="text-[#22c55e] hover:underline">lisow33@gmail.com</a></p>
      </Section>

      <Section title="Hébergement">
        <p>
          Ce site est hébergé par <strong>GitHub Pages</strong> (GitHub, Inc. — 88 Colin P. Kelly Jr. St, San Francisco, CA 94107, États-Unis).
          Aucun serveur backend n'est exploité par l'éditeur du site.
        </p>
      </Section>

      <Section title="Nature du site">
        <p>
          Anime-Ink est une application web monopage (SPA) entièrement côté client, sans compte utilisateur, sans base de données propre et sans collecte de données personnelles sur un serveur.
        </p>
        <p>
          Toutes les données affichées (titres, synopsis, images, scores…) proviennent de l'API publique{' '}
          <a href="https://jikan.moe" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline">Jikan v4</a>,
          un wrapper non officiel de <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="text-[#22c55e] hover:underline">MyAnimeList</a>.
          Anime-Ink n'est affilié ni à Jikan ni à MyAnimeList.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          Les illustrations, affiches et informations relatives aux animés sont la propriété de leurs ayants droit respectifs (studios, éditeurs, auteurs).
          Leur affichage sur ce site s'effectue via l'API Jikan dans un cadre strictement informatif et non commercial.
        </p>
        <p>
          Le code source de l'application est la propriété de son auteur. Toute reproduction ou utilisation à des fins commerciales est interdite sans accord préalable.
        </p>
      </Section>

      <Section title="Données personnelles et stockage local">
        <p>
          Anime-Ink ne collecte, ne transmet et ne stocke <strong>aucune donnée personnelle</strong> sur un serveur distant.
        </p>
        <p>
          Si vous y consentez, certaines données sont conservées dans le <strong>localStorage</strong> de votre navigateur, uniquement sur votre appareil :
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Préférences d'affichage : thème clair/sombre, filtre de contenu adulte</li>
          <li>Données personnelles : favoris, liste de suivi, historique de consultation</li>
        </ul>
        <p>
          Ces données ne quittent jamais votre appareil et peuvent être supprimées à tout moment depuis les paramètres de votre navigateur ou via le gestionnaire de cookies du site.
        </p>
        <p>
          Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et de suppression de ces données.
        </p>
      </Section>

      <Section title="Gestion des cookies et du stockage local">
        <p>
          Anime-Ink n'utilise <strong>aucun cookie</strong> de suivi, publicitaire ou analytique. Le site utilise uniquement le <strong>localStorage</strong> du navigateur à des fins fonctionnelles, avec votre consentement.
        </p>

        <div className="flex flex-col gap-3 mt-1">
          <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--bg-surface)]">
                  <th className="text-left px-3 py-2 text-[var(--text-primary)] font-semibold">Catégorie</th>
                  <th className="text-left px-3 py-2 text-[var(--text-primary)] font-semibold">Données</th>
                  <th className="text-left px-3 py-2 text-[var(--text-primary)] font-semibold">Finalité</th>
                  <th className="text-left px-3 py-2 text-[var(--text-primary)] font-semibold">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <td className="px-3 py-2 text-[var(--text-primary)] font-medium whitespace-nowrap">Essentiel</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Choix de consentement</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Mémoriser vos préférences de cookies</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">Indéterminée</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-[var(--text-primary)] font-medium whitespace-nowrap">Préférences</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Thème, filtre de contenu</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Personnalisation de l'affichage</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">Indéterminée</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-[var(--text-primary)] font-medium whitespace-nowrap">Données perso.</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Favoris, liste, historique</td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">Suivi de visionnage personnel</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">Indéterminée</td>
                </tr>
              </tbody>
            </table>
          </div>

          {consentDate && (
            <p className="text-[var(--text-muted)] text-xs">
              Votre consentement a été enregistré le <strong>{consentDate}</strong>.{' '}
              Préférences actuelles :{' '}
              Affichage {consent.preferences ? '✓ accepté' : '✗ refusé'},{' '}
              Données personnelles {consent.userdata ? '✓ acceptées' : '✗ refusées'}.
            </p>
          )}

          <button
            onClick={openSettings}
            className="self-start text-xs px-4 py-2 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white font-medium transition-colors"
          >
            Gérer mes préférences de cookies
          </button>
        </div>
      </Section>

      <Section title="Limitation de responsabilité">
        <p>
          L'éditeur ne peut être tenu responsable des erreurs, omissions ou indisponibilités des données fournies par l'API Jikan. Les informations affichées sont susceptibles d'être inexactes ou incomplètes.
        </p>
        <p>
          L'accès au site peut être interrompu à tout moment sans préavis, notamment en cas d'indisponibilité de l'API tierce.
        </p>
      </Section>

      <Section title="Droit applicable">
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
        </p>
      </Section>

    </main>
  )
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[var(--text-primary)] font-semibold text-base sm:text-lg border-b border-[var(--border-subtle)] pb-2">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-[var(--text-muted)] text-sm leading-relaxed">
        {children}
      </div>
    </section>
  )
}
