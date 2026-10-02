---
name: diaporama-web
description: Crée un diaporama de présentation en HTML (une page, navigation clavier et tactile, mode plein écran, impression PDF) sans logiciel externe. À utiliser quand on demande des slides ou une présentation dans le navigateur.
---

# Diaporama web

- Une seule page HTML : chaque diapositive est une `<section>` ; une seule est visible à la fois.
- Navigation : flèches clavier, espace, clic sur les côtés, balayage tactile ; `F` pour le plein écran ; numéro de diapo dans l'adresse (`#3`) pour pouvoir revenir à un point précis.
- Mise en page 16:9 qui s'adapte à l'écran (unités `vw`/`vh` ou `clamp`), texte ≥ 28 px une fois projeté, **une idée par diapo**, 6 lignes maximum.
- Version imprimable : `@media print` affiche une diapo par page paysage.
- Contenu dans un tableau JavaScript ou du Markdown simple pour que l'enseignant le modifie facilement.
- Identité Canopé : `charte-canope`. Contrastes et ordre de lecture : `accessibilite-rgaa`.
- Ne pas utiliser d'animations qui gênent la lecture ; respecter `prefers-reduced-motion`.
