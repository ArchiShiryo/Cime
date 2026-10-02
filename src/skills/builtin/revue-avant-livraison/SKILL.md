---
name: revue-avant-livraison
description: Checklist de relecture finale d'une application avant de rendre la main à l'utilisateur (fonctionnement, erreurs, textes, accessibilité, sécurité, sauvegarde). À utiliser à la fin de toute création ou modification importante d'application.
---

# Revue avant livraison

Parcourir dans l'ordre et corriger ce qui échoue avant de répondre :

1. **Ça démarre** : la vérification de types et le build passent ; l'aperçu s'affiche sans erreur dans la console ni dans les journaux.
2. **Le parcours principal fonctionne** de bout en bout, avec des données normales puis avec des cas limites (champ vide, très long texte, caractères accentués, liste vide).
3. **Aucun reste de chantier** : pas de `TODO`, de `console.log` de débogage, de texte d'exemple (« Lorem ipsum »), de données fictives oubliées.
4. **Textes** en français clair, sans faute, cohérents (`interface-claire-en-francais`).
5. **Accessibilité de base** : clavier, contrastes, libellés (`accessibilite-rgaa`).
6. **Sécurité et données** : pas de clé dans le code, saisies échappées (`securite-application-web`), données de personnes protégées (`donnees-eleves-rgpd`).
7. **Écrans variés** : lisible sur téléphone et projeté (`page-adaptee-mobile`).

## Réponse finale (5 lignes maximum)

- Ce qui a été fait, en une phrase.
- Comment l'utiliser (première action à faire).
- Ce qui a été vérifié, et ce qui ne l'a pas pu être.
- Les limites connues ou les décisions à prendre.
