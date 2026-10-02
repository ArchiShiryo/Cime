---
name: deboguer-methodiquement
description: Méthode pas à pas pour diagnostiquer et corriger un bug ou une erreur dans une application (page blanche, erreur de build, fonctionnalité qui ne marche pas). À utiliser dès qu'un problème est signalé ou qu'une vérification échoue.
---

# Déboguer méthodiquement

1. **Reproduire** : écrire précisément ce qui est attendu et ce qui se passe. Lire les journaux de l'application (outil de lecture des logs) et le message d'erreur complet, sans en supposer le sens.
2. **Localiser** : remonter la pile d'appels jusqu'au premier fichier du projet ; lire ce fichier et ses voisins avant de modifier quoi que ce soit.
3. **Une hypothèse à la fois** : formuler la cause probable, la vérifier (lecture du code, ajout d'un `console.log` temporaire), puis seulement corriger.
4. **Corriger à la racine**, pas le symptôme ; changer le minimum de lignes.
5. **Vérifier** : relancer la vérification de types / le build / l'aperçu et refaire le parcours qui échouait. Ne pas déclarer « corrigé » sans l'avoir constaté.
6. **Nettoyer** : retirer les traces de débogage.
7. **Coincé après deux tentatives** : arrêter, résumer à l'utilisateur ce qui est établi et ce qui reste inconnu, proposer des pistes. Ne pas empiler les rustines ni réécrire tout le projet.
