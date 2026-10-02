---
name: fiche-imprimable-a4
description: Crée des pages web destinées à l'impression en A4 ou A5 (fiches, certificats, plannings, affiches) avec une mise en page CSS fiable. À utiliser pour tout document qui sera imprimé ou exporté en PDF depuis le navigateur.
---

# Fiche imprimable

- Utiliser `@page { size: A4; margin: 15mm; }` (ou `A5`) et `@media print` ; masquer boutons et navigation à l'impression.
- Unités physiques (`mm`, `pt`) pour les gabarits ; `break-inside: avoid` sur les blocs qui ne doivent pas être coupés, `break-after: page` pour forcer un saut.
- Couleurs : prévoir une version qui reste lisible en noir et blanc ; ajouter `print-color-adjust: exact` seulement pour les fonds essentiels.
- Corps de texte 10–11 pt, titres hiérarchisés, marges suffisantes pour la perforation (20 mm à gauche si classeur).
- Champs à remplir à la main : lignes de 8 mm de haut minimum, cases à cocher de 5 mm.
- Bouton « Imprimer » (`window.print()`) visible à l'écran uniquement.
- Vérifier l'aperçu avant impression : aucun contenu coupé, numéros de page si plusieurs pages.
- Identité visuelle : `charte-canope`.
