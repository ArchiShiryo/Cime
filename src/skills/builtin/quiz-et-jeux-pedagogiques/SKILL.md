---
name: quiz-et-jeux-pedagogiques
description: Crée des quiz, jeux de mémoire, cartes mémoire (flashcards) et exercices interactifs pour la classe ou un atelier, avec score et retour immédiat. À utiliser quand on demande un jeu, un quiz, un exercice autocorrigé ou une activité ludique.
---

# Quiz et jeux pédagogiques

## Avant de coder

Préciser (en une seule question groupée si besoin) : public et niveau, notion visée, nombre de questions, usage (individuel, projeté en groupe, sur tablette).

## Contenu

- Les questions vivent dans **un seul fichier de données** (`questions.json` ou un tableau en haut du code), jamais dans le HTML, pour que l'enseignant puisse les modifier sans toucher à l'interface.
- Chaque question : énoncé, choix, bonne réponse, **explication courte** affichée après la réponse (le retour immédiat est l'intérêt pédagogique).
- Mélanger l'ordre des questions et des choix à chaque partie.

## Interface

- Une question par écran, gros boutons (utilisables au doigt), progression visible (« 3 / 10 »).
- Score final avec message encourageant, bouton « Rejouer » et « Revoir mes erreurs ».
- Pas de chronomètre stressant par défaut ; l'option doit se désactiver.
- Fonctionne au clavier et au tactile ; contrastes conformes (skill `accessibilite-rgaa`).

## Données

- Ne jamais enregistrer de nom d'élève sans nécessité ; si un score est conservé, c'est en local (voir `donnees-eleves-rgpd`).
