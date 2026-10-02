---
name: accessibilite-rgaa
description: Checklist d'accessibilité (RGAA / WCAG) à appliquer aux pages et applications générées : contrastes, clavier, étiquettes, ARIA, images. À utiliser pour toute interface destinée à un public large ou institutionnel.
---

# Accessibilité (RGAA)

Avant de terminer une interface, vérifier :

1. **Structure** : un seul `<h1>`, titres hiérarchisés, landmarks (`header`, `nav`, `main`, `footer`), attribut `lang="fr"` sur `<html>`.
2. **Contrastes** : texte normal ≥ 4,5:1, grand texte et composants ≥ 3:1. Ne jamais transmettre une information par la seule couleur.
3. **Clavier** : tout est utilisable au clavier, ordre de tabulation logique, focus visible (ne pas faire `outline: none` sans remplaçant).
4. **Formulaires** : chaque champ a un `<label>` associé, les erreurs sont écrites en texte et reliées au champ (`aria-describedby`).
5. **Images** : `alt` utile, `alt=""` si décorative. Pas de texte dans les images.
6. **Composants dynamiques** : préférer les éléments natifs (`button`, `a`, `dialog`) ; n'utiliser ARIA que si nécessaire.
7. **Mouvement** : respecter `prefers-reduced-motion`; pas de contenu clignotant.
8. **Zoom** : l'interface reste utilisable à 200 % ; unités relatives (`rem`).

Mentionner dans la réponse finale les points vérifiés et ceux qui restent à contrôler à la main.
