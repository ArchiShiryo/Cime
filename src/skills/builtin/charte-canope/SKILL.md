---
name: charte-canope
description: Applique la charte graphique Réseau Canopé (couleurs, typographie, ton) à une application ou une page web. À utiliser dès que l'utilisateur parle de Canopé, de charte, d'identité visuelle ou veut un rendu institutionnel.
---

# Charte Réseau Canopé

## Couleurs

- Fond clair : `#F4EFED`
- Turquoise principal (titres, boutons, liens) : `#005A5B`
- Sauge secondaire (accents, bordures) : `#94A088`
- Texte : gris très foncé (`#1F2A2A`), jamais du noir pur.
- Définir ces couleurs comme variables CSS (`--canope-fond`, `--canope-turquoise`, `--canope-sauge`) et ne jamais les répéter en dur.

## Typographie

- Police de titre : Marianne si disponible, sinon une sans-serif lisible (Source Sans 3, system-ui).
- Corps : 16 px minimum, interligne 1,5.

## Ton et mise en page

- Français clair, phrases courtes, pas de jargon.
- Beaucoup d'espace, coins légèrement arrondis, une seule action principale par écran.
- Pas de violet, pas de dégradés criards.
- Le logo Canopé se place en haut à gauche ; ne pas le déformer ni le recolorer.

## Vérifications avant de rendre la main

1. Contraste texte/fond d'au moins 4,5:1 (voir le skill `accessibilite-rgaa`).
2. Les trois couleurs sont définies une seule fois.
