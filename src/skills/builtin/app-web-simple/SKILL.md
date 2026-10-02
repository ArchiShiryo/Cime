---
name: app-web-simple
description: Conventions pour générer dans Cimes des applications web simples, robustes et faciles à maintenir par des non-développeurs (structure, état, validation, vérifications finales). À utiliser quand l'utilisateur demande de créer ou d'étendre une petite application.
---

# Application web simple

## Principes

- Le plus petit nombre de fichiers et de dépendances possible ; pas de bibliothèque ajoutée sans raison écrite.
- Une page = une tâche claire. Interface en français, textes dans un seul endroit.
- Données locales (`localStorage`) tant qu'aucun serveur n'est demandé ; prévoir l'export/import JSON des données.
- Valider les saisies, afficher des messages d'erreur compréhensibles, jamais d'écran blanc.

## Avant de rendre la main

1. Lancer la vérification de types / le build disponible et corriger les erreurs.
2. Relire l'application dans l'aperçu : le parcours principal fonctionne de bout en bout.
3. Vérifier qu'aucun secret (clé d'API) n'est écrit dans le code.
4. Résumer en 3 lignes maximum ce qui a été fait et comment l'utiliser.

Pour l'identité visuelle, utiliser le skill `charte-canope` ; pour l'accessibilité, `accessibilite-rgaa`.
