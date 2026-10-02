---
name: page-adaptee-mobile
description: Rend une interface web utilisable sur téléphone, tablette et grand écran (mise en page fluide, zones tactiles, lisibilité). À utiliser quand une application sera consultée sur des appareils variés ou projetée.
---

# Interface adaptée à tous les écrans

- `<meta name="viewport" content="width=device-width, initial-scale=1">` obligatoire.
- Concevoir **d'abord pour le téléphone** (une colonne), puis enrichir avec des `@media (min-width: …)` à 640 px et 1024 px.
- Mise en page avec Flexbox/Grid et unités relatives (`rem`, `%`, `clamp()`), jamais de largeurs fixes en pixels pour les conteneurs.
- Zones tactiles ≥ 44 × 44 px avec un espacement suffisant ; pas d'action qui ne fonctionne qu'au survol.
- Texte ≥ 16 px (sinon le téléphone zoome dans les champs) ; images `max-width: 100%`.
- Tableaux larges : conteneur à défilement horizontal ou affichage en cartes sur petit écran.
- Tester à 360 px, 768 px et 1280 px de large, et à 200 % de zoom.
