# Feuille de route Anime-Ink

Cette liste sépare les protections déjà livrées des évolutions qui nécessitent une nouvelle infrastructure.

## API Jikan — livré

- limitation globale à moins de 3 requêtes par seconde et 60 requêtes par minute ;
- délai maximal, nouvelles tentatives et prise en charge de `Retry-After` ;
- annulation des recherches et fiches devenues inutiles ;
- déduplication des requêtes identiques simultanées ;
- cache mémoire avec durées adaptées aux listes, recherches, fiches et recommandations ;
- dernière réponse valide servie temporairement pendant une panne ;
- détection des erreurs Jikan contenues dans une réponse HTTP `200` ;
- cache local borné des genres et traductions ;
- état API issu des véritables requêtes du site.

## Prochaines évolutions API

- [ ] ajouter un proxy de cache à la périphérie, par exemple Cloudflare Workers ;
- [ ] exposer des métriques anonymes de disponibilité et de latence ;
- [ ] valider les réponses externes avec des schémas versionnés ;
- [ ] ajouter une stratégie hors ligne pour les fiches déjà consultées ;
- [ ] afficher la date de la dernière donnée valide lorsque le mode dégradé est actif.

## Expérience utilisateur

- [ ] calendrier personnalisé des sorties ;
- [ ] progression par épisode et page « Où reprendre ? » ;
- [ ] import/export JSON des favoris et de la liste ;
- [ ] filtres supplémentaires par année, studio, saison et durée ;
- [ ] statistiques personnelles respectueuses de la vie privée ;
- [ ] comparaison de plusieurs animés.

## Qualité et sécurité

- [ ] tests de parcours complets avec Playwright ;
- [ ] contrôles d’accessibilité automatisés avec axe-core ;
- [ ] hébergement permettant de vrais en-têtes CSP et Permissions-Policy ;
- [ ] budgets Core Web Vitals et poids des bundles dans l’intégration continue.

Références : [documentation Jikan](https://docs.api.jikan.moe/), [projet Jikan REST](https://github.com/jikan-me/jikan-rest), [OWASP CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html), [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/).
