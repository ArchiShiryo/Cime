# Passation Cimes (reprise en local)

À lire en premier par la session qui reprend le travail. Dernière mise à jour : 9 novembre 2026.

## Contexte

**Cimes** est un fork de Dyad 1.17 (Electron) pour les ateliers Réseau Canopé (Cayenne, environ 15 postes Windows verrouillés), élargi à tous les agents de la fonction publique. Fournisseur par défaut : **Albert (DINUM)**, avec DeepSeek V4 Flash. La clé est demandée au premier lancement. Elle ne doit jamais être écrite dans le dépôt.

L'atelier entier dépend de la réussite de ce projet. Soyez factuel sur ce qui est vérifié et ce qui ne l'est pas.

- Dépôt : `ArchiShiryo/Cime`
- Branche de travail : `claude/dyad-themes-ucuvhn` (tout est poussé, dernier commit `a608bd2`)
- PR ouverte, **non fusionnée** : <https://github.com/ArchiShiryo/Cime/pull/4>. Le propriétaire fusionne lui-même, ne le faites pas.
- Dernier build Windows réussi : run n° 8, commit `da19327`, <https://github.com/ArchiShiryo/Cime/actions/runs/37835338282>. Il date d'avant `CHECKLIST.md` et ce fichier, qui ne changent pas l'application.

## Ce qui est fait

Albert, projets (4 modèles, RAG, OCR, renommer, supprimer, déplacer), personnalisation (préférences, mémoire), sources officielles, traitement par lot, journal d'activité, lecture `.odt/.ods/.odp`, export PDF, skills au format Claude, MCP sans Dyad, interface en français par défaut (anglais en option), police Marianne, note « Pourquoi cette approche » (Projets et Apps), aucune télémétrie ni offre payante. Détail complet : `ROADMAP.md`.

## Ce qui est vérifié, et ce qui ne l'est pas

Vérifié :

- tests unitaires des zones touchées, `npm run ts` ;
- application packagée **sous Linux** avec DeepSeek (scripts dans `testing/cimes-e2e/`, voir son `README.md`).

**Jamais vérifié** :

- **Windows** : aucune exécution, y compris OCR, lot, fichiers LibreOffice réels, proxy et réseau verrouillé, SmartScreen ;
- GPT-OSS et Mistral avec une vraie clé Albert, lots de 100 fichiers ;
- Légifrance avec de vraies clés PISTE ;
- relecture humaine de la traduction française ;
- rendu visuel de la police Marianne et de la note (seul le build de l'interface a été vérifié).

## Priorités pour la session locale

1. Lancer le build sous Windows et dérouler `CHECKLIST.md` partie 2 en regardant l'écran. C'est ce qui manque le plus.
2. Corriger les textes encore en anglais (accueil, chat, aperçu, en-tête). Priorité haute : c'est du service public. Outils : `scripts/i18n/`, `src/i18n/ui_fr.json`, `testing/cimes-e2e/i18n_audit.mjs`.
3. PDF fabriqué par le modèle avec le titre en double (paramètre titre plus titre dans le texte).
4. Décider pour Annuler / Réessayer dans les projets (ils s'appuient sur git).
5. Fiche de dépannage d'une page pour l'animateur (clé, réseau, OCR lent).
6. Ensuite seulement : orchestrateur Albert souverain, canal nightly (voir `ROADMAP.md`).

Reporté volontairement : politique DSI, tâches guidées, tâches planifiées, OCR manuscrit.

## Récupérer le projet

```sh
git clone https://github.com/ArchiShiryo/Cime.git
cd Cime
git checkout claude/dyad-themes-ucuvhn
```

Sans git : ZIP de la branche, <https://github.com/ArchiShiryo/Cime/archive/refs/heads/claude/dyad-themes-ucuvhn.zip> (connecté à GitHub si le dépôt est privé). Si le dossier existe déjà : `git fetch origin && git checkout claude/dyad-themes-ucuvhn && git pull`.

## Lancer en local

```sh
npm install
npm run init-precommit
npm run prepare:ocr          # OCR hors ligne, nécessaire pour make/package
npm run make                 # produit le ZIP portable et le Setup.exe (Windows)
```

Alternative sans compiler : le workflow GitHub `Build Windows (portable + installer)` sur la branche (environ 10 minutes). Artefacts dans la page du run.

Avant tout commit : `npm run fmt`, `npm run lint`, `npm run ts`. Tests : `npm test -- chemin/du/test`. Lire `AGENTS.md` et le fichier de `rules/` correspondant avant de modifier un domaine.

## Pièges connus

- `npm run fmt` reformate parfois `scripts/prepare-ocr.mjs` : annulez avec `git checkout scripts/prepare-ocr.mjs`, ce n'est pas un vrai changement.
- `npm run lint` : une erreur reste dans `testing/cimes-e2e/i18n_audit.mjs` (paramètre inutilisé), hors application.
- Des suites échouent déjà sur `main` (modules natifs `node-pty`, Monaco) : ce n'est pas lié aux changements.
- Test sur l'application packagée sous Linux : `CIMES_E2E=1 CIMES_E2E_BASE_URL=https://api.deepseek.com/v1 CIMES_E2E_MODEL=deepseek-flash ALBERT_KEY_FOR_TEST=x APP_EXTRA_ARGS="--ignore-certificate-errors"`.
- Les chaînes visibles sont traduites à l'affichage (`src/i18n/dom_translator.ts`, dictionnaire `ui_fr.json`) ; le backend, les prompts et les skills restent en anglais. Ne traduisez pas le backend.
- Marianne (`src/assets/fonts/marianne/`, Etalab 2.0) est réservée à l'administration : à retirer si diffusion hors sphère publique.

## Hors du code (actions du propriétaire)

Révoquer la clé Albert provisoire, fusionner la PR, build propre depuis `main`, clés PISTE, signature de l'installeur et canal de mise à jour. Liste complète : `CHECKLIST.md` partie 4.
