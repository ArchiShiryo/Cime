# Checklist Cimes avant l'atelier

Cochez au fur et à mesure. « Moi » = ce que vous faites ; « Claude » = ce que je fais.

## 1. Récupérer le bon build

- [ ] Moi : ouvrir <https://github.com/ArchiShiryo/Cime/actions/workflows/build-windows-portable.yml>
- [ ] Moi : prendre le run **le plus récent** (commit « Police Marianne… »), terminé en vert
- [ ] Moi : télécharger les artefacts (ZIP portable + `Setup.exe`)
- [ ] Moi : désinstaller l'ancienne version, ou décompresser le ZIP dans un dossier neuf

## 2. Test sur un poste Windows (20 min)

Premier lancement

- [ ] L'interface démarre **en français**
- [ ] Paramètres > Général > Langue : seulement **Français** et **English**
- [ ] La police est **Marianne** (pas de chemin affiché sous les noms de projet)
- [ ] La clé Albert est demandée au premier lancement, et elle est acceptée
- [ ] Aucune mention Pro / payant / Dyad visible

Projets

- [ ] Créer un projet (un des 4 modèles)
- [ ] Ajouter un PDF **scanné** dans la documentation, puis « Créer le RAG »
- [ ] Poser une question dont la réponse n'est que dans ce scan
- [ ] Ajouter un `.odt` fait avec un vrai LibreOffice : il est lu
- [ ] Demander un export PDF d'un texte
- [ ] Renommer le projet, déplacer une conversation, supprimer (case de confirmation)

Agent

- [ ] Recherche web et lecture d'une page
- [ ] Une commande shell simple (confirmation demandée)
- [ ] Traitement par lot sur 3 à 5 fichiers
- [ ] Personnalisation : vouvoiement + signature appliqués dans une réponse
- [ ] Mémoire : « souviens-toi que… », puis la retrouver dans une autre conversation

Interface

- [ ] Bascule clair / sombre
- [ ] Icône « Pourquoi cette approche » sur Projets et Apps : la bulle s'ouvre, les liens s'ouvrent dans le navigateur
- [ ] Noter / capturer chaque texte encore en anglais

## 3. Postes de l'atelier (Cayenne)

- [ ] Tester sur **un vrai poste verrouillé** (proxy, filtrage, droits limités)
- [ ] Vérifier que `albert.api.etalab.gouv.fr` est joignable depuis ce réseau
- [ ] L'installeur passe (SmartScreen, antivirus) ; sinon prévoir le ZIP portable
- [ ] Un poste de secours prêt

## 4. Actions qui n'appartiennent qu'à vous

- [ ] **Révoquer la clé Albert provisoire** (et en générer une par poste ou par groupe)
- [ ] Relire la PR #4 puis la **fusionner**
- [ ] Refaire un build propre depuis `main`
- [ ] Clés PISTE (Légifrance) si l'atelier doit les utiliser
- [ ] Faire relire la traduction française par une personne
- [ ] Licence : Marianne est réservée à l'administration, à retirer si diffusion hors sphère publique

## 5. Claude, après vos retours

- [ ] Corriger les défauts relevés au test et relancer un build
- [ ] Textes encore en anglais : corriger à partir de vos captures
- [ ] PDF fait par le modèle avec le titre en double
- [ ] Fiche de dépannage d'une page pour l'animateur (clé, réseau, OCR lent)
- [ ] Décider : garder ou masquer Annuler / Réessayer dans les projets

## 6. Pas encore testé (à garder en tête)

- [ ] GPT-OSS et Mistral avec une vraie clé Albert (appels d'outils)
- [ ] Lot de 100 fichiers sur Albert
- [ ] Légifrance avec de vraies clés PISTE
- [ ] Mode hors ligne, import d'un skill `.zip` malveillant, commande shell très longue

## Plus tard

Orchestrateur Albert souverain, canal nightly, OpenRouter pour les sous-agents, pilotage à distance, lecture de mails, partage de projets : voir `ROADMAP.md`.
