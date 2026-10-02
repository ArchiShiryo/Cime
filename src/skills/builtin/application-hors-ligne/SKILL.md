---
name: application-hors-ligne
description: Rend une application web utilisable sans connexion internet ou avec une connexion instable (service worker, cache, sauvegarde locale, synchronisation différée). À utiliser pour des usages en classe, en déplacement ou dans des zones à faible débit.
---

# Application hors ligne

1. **Ne rien charger depuis un CDN** à l'exécution : polices, icônes et bibliothèques sont embarquées dans le projet.
2. **Service worker** (`sw.js`) : mise en cache des fichiers de l'application au premier chargement (stratégie « cache d'abord, réseau en secours » pour les fichiers, « réseau d'abord » pour les données), numéro de version du cache et nettoyage des anciens caches.
3. **Manifest** (`manifest.webmanifest`) pour pouvoir « installer » l'application sur tablette ou ordinateur.
4. **Données** en local (`localStorage` pour peu de données, IndexedDB sinon) ; si une synchronisation existe, mettre les envois en file d'attente et les rejouer au retour du réseau.
5. **Interface** : indicateur clair « hors ligne » ; aucune action ne doit échouer silencieusement.
6. **Vérifier** : charger la page, couper le réseau (outils du navigateur), recharger : l'application doit s'afficher et fonctionner.
