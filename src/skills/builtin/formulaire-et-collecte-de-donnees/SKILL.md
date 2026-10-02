---
name: formulaire-et-collecte-de-donnees
description: Construit des formulaires de saisie, fiches d'inscription ou tableaux de suivi avec validation, stockage local et export CSV/JSON. À utiliser pour collecter, saisir ou suivre des informations (inscriptions, présences, évaluations).
---

# Formulaire et collecte de données

1. **Modéliser** : lister les champs (nom, type, obligatoire ou non). Un champ = une question ; pas de champ « au cas où ».
2. **Valider** à la saisie et à l'envoi : formats (e-mail, date, nombre), messages d'erreur en français, reliés au champ (`aria-describedby`), jamais d'alerte bloquante.
3. **Stocker en local** (`localStorage` ou IndexedDB) tant qu'aucun serveur n'est demandé ; proposer **Exporter en CSV** (séparateur `;`, encodage UTF-8 avec BOM pour Excel) et **Importer/Exporter en JSON** pour sauvegarder.
4. **Afficher** les données dans un tableau triable/filtrable, avec bouton de suppression confirmé.
5. **Protéger** : échapper tout texte saisi avant affichage (jamais `innerHTML` avec une saisie), limiter les longueurs.
6. Prévenir que les données restent sur cet ordinateur et expliquer comment les sauvegarder.

Données de personnes : appliquer `donnees-eleves-rgpd`.
