---
name: creer-un-skill
description: Aide à écrire un nouveau skill au format Claude (dossier avec SKILL.md) que l'utilisateur peut importer dans Cimes. À utiliser quand l'utilisateur veut capitaliser une méthode, une consigne ou une charte sous forme de skill réutilisable.
---

# Créer un skill

Un skill est un dossier portant le nom du skill, avec un fichier `SKILL.md` :

```
mon-skill/
  SKILL.md          (obligatoire)
  references/       (documents lus à la demande, optionnel)
  scripts/          (scripts, optionnel)
  assets/           (modèles, images, optionnel)
```

## Démarche

1. Demander **ce que le skill doit permettre** et **dans quelles situations il se déclenche** ; recueillir un ou deux exemples réels.
2. Écrire l'en-tête YAML :
   ```
   ---
   name: nom-en-minuscules-avec-tirets
   description: Ce que fait le skill ET quand l'utiliser (c'est ce texte qui décide du déclenchement : être précis, 1 à 3 phrases).
   ---
   ```
3. Écrire le corps en Markdown : instructions à l'impératif, étapes numérotées, critères de vérification. Rester sous 500 lignes ; déplacer le détail dans `references/` et le mentionner (« voir references/regles.md »).
4. N'ajouter un script que s'il apporte une vraie fiabilité ; expliquer son usage et ne jamais y mettre de secret.
5. Créer le dossier dans l'application (`.cimes/skills/<nom>/SKILL.md`) ou le fournir en `.zip` à importer dans Paramètres > IA > Skills.
6. Tester avec une demande réaliste : le skill est-il listé, se déclenche-t-il, les consignes suffisent-elles ?
