---
name: tableau-de-bord-et-graphiques
description: Transforme des données (CSV, tableau saisi, résultats) en tableau de bord et graphiques lisibles et accessibles. À utiliser pour visualiser, comparer ou présenter des chiffres.
---

# Tableau de bord et graphiques

- **Choisir la forme selon la question** : comparer des catégories → barres horizontales ; évolution dans le temps → courbe ; part d'un tout (≤ 5 parts) → barre empilée ou anneau ; relation entre deux nombres → nuage de points. Éviter le camembert 3D, les doubles axes et les axes tronqués.
- **Bibliothèque** : SVG écrit à la main pour un graphique simple ; sinon une seule bibliothèque légère (Chart.js) déjà adaptée au projet.
- **Lisibilité** : titre qui énonce le message (« Les inscriptions ont doublé en mars »), unités sur les axes, valeurs directement sur les barres quand c'est possible, légende proche des données.
- **Couleurs** : palette Canopé (`charte-canope`), au maximum 5 couleurs distinctes, jamais la couleur seule pour distinguer (ajouter motif, étiquette ou forme).
- **Accessibilité** : alternative texte du graphique (`role="img"` + `aria-label` ou tableau de données masqué visuellement), contrastes ≥ 3:1.
- **Import** : lire un CSV choisi par l'utilisateur (`<input type="file">`), détecter `;` et `,`, signaler les lignes invalides au lieu de planter.
- **Impression** : feuille de style `@media print` pour exporter le tableau de bord en PDF depuis le navigateur.
