# Passation Codex : terminer le harnais de Cimes

Dépôt : `ArchiShiryo/Cime` (fork de Dyad 1.17, produit renommé **Cimes**).
Branche de travail : `claude/dyad-themes-ucuvhn` (poussée, **non fusionnée** dans `main`).
Lire d'abord `AGENTS.md`, `CONTRIBUTING.md`, puis les fichiers de `rules/` qui concernent la zone touchée
(`electron-ipc.md`, `dyad-errors.md`, `local-agent-tools.md`, `e2e-testing.md`, `adding-settings.md`).
Le rapport technique du fork est dans `ALBERT_FORK_HANDOFF.md` (à tenir à jour).

## 1. Le produit, en deux phrases

Cimes = Dyad (constructeur d'applications par agent IA, Electron) préconfiguré pour l'**API Albert (DINUM)**
avec **DeepSeek V4 Flash** (`deepseek-v4-flash-0731`, contexte 131072, sortie max 8192), pour des ateliers
Canopé en Guyane (environ 15 postes Windows). L'utilisateur colle sa clé Albert au premier lancement, rien
d'autre à configurer. Aucune offre payante, aucune télémétrie vers Dyad.

## 2. Ce qui est fait (ne pas refaire)

| Sujet                                                                                                               | Où                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Albert : fournisseur `custom::albert`, validation `GET /v1/models`, clé chiffrée (`safeStorage`), écran obligatoire | `src/shared/albert.ts`, `src/ipc/services/albert_service.ts`, `src/components/AlbertOnboarding.tsx`, `src/lib/albertOnboarding.ts`                                             |
| Drapeaux de fork                                                                                                    | `src/shared/branding.ts` : `PAID_FEATURES_ENABLED=false`, `TELEMETRY_ENABLED=false`, `AUTO_UPDATE_AVAILABLE=false`, `LOCAL_WEB_TOOLS_ENABLED=true`, `APP_DISPLAY_NAME="Cimes"` |
| Offres payantes masquées, quota local de 20 messages/jour supprimé                                                  | partout, via `PAID_FEATURES_ENABLED`                                                                                                                                           |
| Télémétrie PostHog coupée, mise à jour automatique coupée                                                           | `src/renderer.tsx`, `src/main.ts`                                                                                                                                              |
| Thème clair Canopé par défaut + bascule clair/sombre                                                                | `src/styles/globals.css`, `src/components/app-sidebar.tsx`                                                                                                                     |
| Écran de démarrage fiable, GIF d'installation Squirrel Cimes, icône `.ico`                                          | `src/splash/`, `assets/installer/`, `assets/icon/`                                                                                                                             |
| **Agent : lecture de pages web locale** (`web_fetch`)                                                               | `src/pro/main/ipc/handlers/local_agent/tools/local_web.ts`, `web_fetch.ts`                                                                                                     |
| **Agent : recherche web locale** (`web_search`, DuckDuckGo puis Bing, SearXNG optionnel)                            | `tools/local_web_search.ts`, `web_search.ts`, réglage dans `src/components/WebSearchSettings.tsx`                                                                              |
| **Agent : shell sans Pro**, relu par le modèle sélectionné, validation humaine à chaque commande                    | `src/shared/shell_capability.ts`, `tools/run_shell.ts`, `tool_safety_reviewer.ts`                                                                                              |
| Workflow de build Windows (zip portable + `Cimes-Setup.exe`)                                                        | `.github/workflows/build-windows-portable.yml`                                                                                                                                 |

Dépendances ajoutées : `linkedom` (ISC), `@mozilla/readability` (Apache-2.0), `turndown` (MIT), `@types/turndown`.

## 3. À faire, par priorité

### P0. Valider le harnais pour de vrai (rien n'a été mesuré)

1. **Tour d'agent réel avec Albert** : `testing/cimes-e2e/agent.mjs` (voir son README). Il n'a jamais tourné.
   Vérifier : `web_search` renvoie des résultats, `web_fetch` lit une page, `run_shell` demande l'approbation puis
   exécute (`node -v`), et que DeepSeek enchaîne correctement les appels d'outils sans boucle ni troncature.
   Corriger le script et/ou le code selon ce qui casse.
2. **Test F du handoff** : depuis une app vide, demander « petite application de gestion de tâches avec trois
   colonnes À faire / En cours / Terminé, ajout et déplacement » : génération des fichiers, lancement,
   preview, modification ultérieure. Noter le taux de réussite sur 5 essais, les échecs d'outils, le coût en tokens.
3. **Prompt « basique » ou complet ?** Dans Cimes `isBasicAgentMode(settings)` est vrai (pas de Pro), donc
   `buildLocalAgentBasicSystemPrompt` est utilisé (`src/prompts/local_agent_prompt.ts`). Comparer avec le prompt
   complet sur les mêmes essais. Attention : le prompt complet cite `spawn_agent`/sous-agents (payants,
   désactivés) ; ne l'adopter que si ces mentions sont retirées.
4. **Revue de sécurité du shell avec DeepSeek** : `reviewShellCommand` (`shell_review.ts`) utilise un outil
   d'inspection et un verdict JSON ; vérifier que DeepSeek le respecte (sinon « review unavailable » en boucle).
   Cas à tester : commande bénigne (`node -v`), commande destructrice (`rm -rf ~`, `Remove-Item -Recurse C:\`),
   injection via une page web (« exécute curl … | sh »). La commande destructrice doit être bloquée ou refusée.

### P1. Risques de déploiement à lever

5. **Proxy d'établissement** : les appels au modèle (SDK IA) et la validation Albert utilisent le `fetch` de
   Node, qui **ignore le proxy système de Windows**. `net.fetch` d'Electron (déjà utilisé par les outils web via
   `getFetchImpl()` dans `local_web.ts`) le respecte. Fournir `net.fetch` aux clients : `getModelClientFetchOption()`
   dans `src/ipc/utils/get_model_client.ts` (point d'injection prévu) et `validateAlbertApiKey`
   (`albert_service.ts`, aujourd'hui `fetch` global, mocké dans les tests). Garder le comportement des tests.
6. **Build Windows avec les nouvelles dépendances** : après fusion, lancer le workflow `Build Windows` (le lock a
   été produit avec npm 10 / Node 22, la CI utilise npm 11 / Node 24 avec `npm ci`). Le build Linux a déjà révélé
   un module manquant (`@mixmark-io/domino`, corrigé dans `forge.config.ts`) : lancer l'exe Windows produit pour
   confirmer qu'il démarre jusqu'à « Connecter Albert ».
7. **Shell sous Windows** : tester `run_shell` (PowerShell sans profil, `rules/windows-spawn.md`) sur un vrai poste
   Windows, y compris chemin avec espaces et sortie accentuée.
8. **Recherche web depuis un réseau scolaire** : DuckDuckGo limite souvent les adresses partagées ; Bing sert de
   repli et n'est pas garanti. Tester depuis le réseau cible. Si c'est fragile, l'option robuste est un serveur
   SearXNG (réglage déjà prévu) ou l'API Brave Search (clé gratuite, à stocker chiffrée : voir comment
   `writeSettings` chiffre `providerSettings`).

### P2. Finitions demandées par l'utilisateur

9. **Retirer le violet** : environ 350 occurrences de `purple-*`/`indigo-*`/`violet-*` codées en dur dans une
   cinquantaine de fichiers (le bandeau « Enable » des notifications utilise indigo,
   `src/components/chat/SkippableBanner.tsx`). Plutôt que tout réécrire : redéfinir ces palettes Tailwind v4
   dans `@theme` de `src/styles/globals.css` (`--color-indigo-*`, `--color-purple-*`, `--color-violet-*`,
   `--color-fuchsia-*`) vers une rampe turquoise Canopé (`#005A5B` au centre). Vérifier clair et sombre.
10. **Derniers « Dyad » visibles** : l'agent se présente « I'm Dyad » (prompts : `local_agent_prompt.ts` lignes
    ~37 et ~455, `system_prompt.ts` ~68, `plan_mode_prompt.ts`) ; le panneau de preview dit « Dyad is setting up a
    private Node.js runtime » ; autres langues dans `src/i18n/locales/*`. Mettre à jour les snapshots
    (`src/prompts/__snapshots__`, `npm test -- -u` après vérification du diff).
11. **Vrais skills** (demande de l'utilisateur) : aujourd'hui seuls existent les prompts `/slug` (Bibliothèque),
    `AI_RULES.md`, l'outil `read_guide` (3 guides compilés) et MCP. Concevoir un dossier de skills
    (`<userData>/skills/<nom>/SKILL.md` avec nom + description), lister noms et descriptions dans le prompt, ajouter
    un outil `read_skill` calqué sur `read_guide` (`tools/read_guide.ts`), un écran de gestion, et livrer quelques
    skills Canopé (charte graphique `#F4EFED` / `#005A5B` / `#94A088`, polices Marianne, accessibilité RGAA).
12. **Services Dyad encore contactés au démarrage** (sans donnée d'usage) : catalogue de modèles, modèles
    d'applications, config distante, catalogue MCP (`api.dyad.sh`). Vérifier le repli hors ligne ; envisager de les
    couper derrière `PAID_FEATURES_ENABLED` si l'utilisateur veut zéro contact avec Dyad.

### P3. Qualité

13. Lancer la suite complète ; des échecs préexistants viennent de modules natifs absents du bac à sable Linux
    (`node-pty`, `@vscode/ripgrep`, `dugite`) : ils échouent à l'identique sur `main`. Sur Windows/CI ils
    doivent passer, **dont `tool_definitions.test.ts`, qui n'a pas pu être exécuté ici** (vérifier qu'aucune
    attente « web/shell réservés à Pro » n'y subsiste).
14. `shell_process.test.ts` est instable (échec ~1 fois sur 3), sans lien avec ces changements.

## 4. Pièges connus

- **Node 22 dans le bac à sable, 24 requis** : `npm install --engine-strict=false --ignore-scripts`. Ne pas
  commiter un `package-lock.json` réécrit en bloc (npm supprime la ligne `libc` d'un paquet sur Linux : la
  restaurer, le diff du lock ne doit contenir que des ajouts).
- Avant `npm run package` : `npm rebuild dugite`. Les « fuses » interdisent l'inspection : piloter l'exe avec
  `--remote-debugging-port` + `chromium.connectOverCDP` (voir `testing/cimes-e2e/`).
- Les tests du fork qui dépendent des offres payantes simulent `@/shared/branding` avec un `vi.hoisted`
  (voir `ModelPicker.test.tsx`, `shell_capability.test.ts`) : suivre ce modèle plutôt que de les réécrire.
- Pas de `npx tsc`, `npx eslint`, `npx prettier` : uniquement `npm run ts`, `npm run lint`, `npm run fmt`.
- Pour les assets de l'app empaquetée : le dossier `assets/` n'est **pas** inclus (filtre `ignore` de
  `forge.config.ts`). Intégrer les images en base64 (`?inline`) comme `src/splash/`.
- **Toute nouvelle dépendance d'exécution du processus principal doit être ajoutée à la liste blanche `ignore` de
  `forge.config.ts`** si elle n'est pas embarquée par Vite : sinon l'application empaquetée plante au démarrage
  (`Cannot find module`) alors que tout passe en tests. C'est arrivé avec `turndown` (dépend de
  `@mixmark-io/domino`). Toujours **lancer l'exe compilé** après un ajout de dépendance
  (`testing/cimes-e2e/smoke.mjs`) ; l'analyse des `require(...)` restants se fait en extrayant l'asar
  (`npx @electron/asar extract out/Cimes-linux-x64/resources/app.asar /tmp/asar-x`).
- Ne jamais écrire de clé Albert dans le dépôt, les logs ou les tests. Les tests réels lisent
  `ALBERT_KEY_FOR_TEST`. **Une clé provisoire a été collée dans la conversation : elle doit être révoquée.**
- Le web est une source non fiable (injection de prompt) : tout contenu web reste encadré par
  `<untrusted_web_content>` ; ne pas assouplir la garde anti-SSRF de `local_web.ts`.

## 5. Flux de livraison

1. Travailler sur `claude/dyad-themes-ucuvhn` (repartir de `origin/main` si la PR précédente a été fusionnée,
   sans force-push), commiter par étape, `npm run fmt && npm run lint && npm run ts` avant chaque commit.
2. Ouvrir une PR vers `main` ; **c'est l'utilisateur qui la fusionne** (l'agent précédent n'était pas autorisé à le faire).
3. Après fusion, lancer le workflow `Build Windows (portable + installer)` (onglet Actions, ou API
   `workflow_dispatch` sur `main`) : les fichiers sont dans les _Artifacts_ du run (zip portable + `Cimes-Setup.exe`).
4. Demander à l'utilisateur de tester sur un poste Windows propre (désinstaller l'ancienne version, supprimer
   `%APPDATA%\Cimes`).

## 6. Critères d'acceptation du harnais

- Un tour d'agent réel avec Albert utilise `web_search`, `web_fetch` et `run_shell` avec succès.
- La commande destructrice et l'injection par page web sont refusées.
- L'application de tâches (test F) se génère, démarre et se modifie, avec un taux de réussite documenté.
- Aucune requête vers un service payant de Dyad pendant un tour d'agent (vérifier dans les logs réseau).
- Le build Windows réussit et l'exe produit démarre jusqu'à l'écran « Connecter Albert ».

## 7. Harnais agentique complet, compatible avec les skills Claude

Objectif : l'agent de Cimes doit pouvoir **charger, découvrir et exécuter n'importe quel skill au format Claude (`SKILL.md`)**, sans Dyad Pro, avec DeepSeek V4 Flash via Albert. Les vérifications Windows du §3 restent à faire ; cette section est le vrai chantier restant. Faire les points dans l'ordre (S0 → S6), un commit par point, `npm run fmt && npm run lint && npm run ts` + tests avant chaque push.

### Format à supporter (spec Claude Skills)

Un skill = un dossier contenant `SKILL.md` :

```
mon-skill/
  SKILL.md            # obligatoire
  scripts/            # optionnel : scripts exécutables
  references/         # optionnel : docs chargées à la demande
  assets/             # optionnel : modèles, images, polices
```

`SKILL.md` commence par un frontmatter YAML : `name` (minuscules, chiffres, tirets, ≤ 64 car., identique au nom du dossier), `description` (≤ 1024 car., dit **quoi** et **quand** l'utiliser), optionnels : `allowed-tools`, `license`, `metadata`, `argument-hint`, `disable-model-invocation`, `user-invocable`. Le corps est du Markdown. Les champs inconnus sont ignorés sans erreur (tolérance : ne jamais rejeter un skill Claude valide).

### S0 — Loader (pur, testable)

- Nouveau module `src/skills/` (hors `pro/`) : `parseSkill(dir)` (frontmatter via `yaml`/`js-yaml` déjà présent ou à ajouter à l'allowlist Forge, cf. §4), validation souple, `discoverSkills(roots)`.
- Racines, par priorité croissante : skills **intégrés** (dans l'app, voir S5), `<userData>/skills/`, et pour l'app ouverte `<app>/.cimes/skills/` **et** `<app>/.claude/skills/` (compatibilité directe avec un dépôt qui contient déjà des skills Claude).
- Un skill plus proche écrase un skill du même nom ; signaler le doublon dans les logs.
- Ne jamais suivre un lien symbolique qui sort du dossier du skill ; plafonner la taille de `SKILL.md` (≈ 100 Ko) et le nombre de skills.
- Tests : frontmatter valide/invalide, champs inconnus, doublons, symlink évadé, BOM/CRLF Windows.

### S1 — Divulgation progressive (cœur de la compat)

1. **Niveau 1** : le prompt système n'embarque que `name` + `description` de chaque skill (liste courte, ~100 tokens/skill) dans un bloc `<available_skills>`, avec la consigne : « si la demande correspond à un skill, charge-le avec `read_skill` avant d'agir ». Fonctionne pour les prompts _basic_ et _full_ (`local_agent_prompt.ts`) ; mettre à jour les snapshots (`rules/prompt-guides.md`).
2. **Niveau 2** : nouvel outil agent `read_skill({ name })` (`tools/read_skill.ts`, enregistré dans `tool_definitions.ts`, `modifiesState: false`, consentement « always », autorisé en Ask/Plan) → renvoie le corps de `SKILL.md` + la liste des fichiers du skill (chemins relatifs).
3. **Niveau 3** : les fichiers `references/*`, `assets/*` sont lus à la demande avec l'outil de lecture existant ; ajouter à `read_skill` un paramètre optionnel `file` pour lire un fichier du skill **sans** sortir du dossier (chemin normalisé, refus de `..`).
4. Les skills ne sont **pas** copiés dans l'app de l'utilisateur ; ils restent dans leur dossier d'origine.
5. Test d'intégration : prompt contient les descriptions et pas les corps ; `read_skill` renvoie le corps ; `read_skill` avec `../../x` est refusé.

### S2 — Invocation explicite `/nom-du-skill`

Réutiliser le mécanisme existant des `/slug` prompts : `/nom [arguments]` charge le skill et injecte son corps comme message utilisateur (`$ARGUMENTS` remplacé, comme dans Claude Code). `disable-model-invocation: true` → exclu de `<available_skills>` mais invocable à la main ; `user-invocable: false` → l'inverse. Autocomplétion dans le Lexical editor des chats (voir `rules/chat-mentions.md`).

### S3 — Exécution des scripts d'un skill

- Les scripts passent **uniquement** par `run_shell` (revue par le modèle + consentement « Ask »). Aucune exécution implicite à l'import ou à la lecture.
- Fournir au shell les variables `CLAUDE_SKILL_DIR` / `CIMES_SKILL_DIR` (chemin absolu du skill) et remplacer `${CLAUDE_SKILL_DIR}` dans le corps du skill au chargement, pour que les commandes des skills Claude marchent telles quelles.
- Windows : PowerShell ; si le skill appelle `python`, `bash` ou `node` absents, l'agent doit expliquer proprement ce qui manque (ne pas inventer). Vérifier `rules/windows-spawn.md`. Un skill qui exige Bash ne doit pas être présenté comme fiable sous Windows : l'indiquer dans l'UI (badge « scripts : bash »).
- `allowed-tools` : correspondance des noms Claude → outils Cimes (`Read→read_file`, `Write/Edit→write_file/edit_file/search_replace`, `Bash→run_shell`, `WebFetch→web_fetch`, `WebSearch→web_search`, `Grep→grep`, `Glob→list_files`). Sémantique retenue : ces outils sont **pré-approuvés pour la durée du skill chargé** uniquement s'ils sont déjà « Ask » (jamais de passage à « always » persistant, jamais de contournement de la revue shell ni du garde SSRF). Outil inconnu : ignoré + log.

### S4 — Import et gestion (UI)

- Paramètres > « Skills » : liste (nom, description, origine : intégré / utilisateur / app), activer/désactiver par skill (setting persistant), supprimer (utilisateur seulement), « Ouvrir le dossier ».
- Import : dossier **ou** `.zip` / `.skill` contenant un skill (`SKILL.md` à la racine ou dans un unique dossier). Extraction vers `<userData>/skills/<name>/` avec protection **zip-slip**, limites de taille (ex. 20 Mo / 500 fichiers), validation S0, confirmation affichant la description et la liste des scripts (« ce skill contient des scripts : ils ne s'exécuteront qu'avec votre accord »).
- IPC typé selon `rules/electron-ipc.md` (contrat + hook React Query, clés dans `queryKeys.ts`), erreurs en `DyadError`.
- Ajouter l'entrée au `settingsSearchIndex.ts` et respecter `rules/adding-settings.md`, `rules/base-ui-components.md`, `rules/i18n.md`.

### S5 — Skills intégrés Canopé

À livrer dans `src/skills/builtin/` (copiés/inlinés au build : `assets/` n'est pas packagé, cf. §4 ; vérifier dans le paquet Linux que `read_skill` les trouve) :

- `charte-canope` : palette (`#F4EFED` fond, `#005A5B` turquoise, `#94A088` sauge), typographie Marianne/alternatives libres, ton institutionnel, usage du logo.
- `accessibilite-rgaa` : checklist RGAA/contraste/clavier/ARIA appliquée aux apps générées.
- `atelier-pedagogique` : structure d'un atelier (objectif, durée, matériel, pas-à-pas pour un public non technique) et rédaction en français clair.
- `app-web-simple` : conventions pour générer des apps front simples et robustes dans Cimes (stack par défaut, structure de fichiers, vérifications avant de rendre la main).
  Chacun ≤ 500 lignes, `description` précise (sinon DeepSeek ne les déclenchera pas).

### S6 — Reste du harnais (sans Dyad Pro)

Dans l'ordre d'utilité pour les ateliers :

1. **Boucle agent fiable avec DeepSeek V4 Flash** : lancer `testing/cimes-e2e/agent.mjs` (jamais exécuté) avec `ALBERT_KEY_FOR_TEST` ; mesurer sur 5 runs la génération d'une app + preview, les appels d'outils mal formés, les boucles. Ajuster descriptions d'outils/prompt _basic_ en conséquence (§3).
2. **Planification / todos** : vérifier que `update_todos` (ou équivalent) et le mode Plan fonctionnent sans Pro ; sinon les rendre disponibles.
3. **Sous-agents / exploration** : l'exploration de code est un service Pro. Fournir une version locale : un outil `explore` qui lance une boucle courte, lecture seule (`read_file`, `grep`, `list_files`), avec le même modèle, et renvoie un résumé ; plafonner étapes et tokens.
4. **Compaction de contexte** : fenêtre Albert = 131 072 tokens ; vérifier que la compaction/troncature d'historique se déclenche avant dépassement (tests avec historique long, sorties shell/web volumineuses tronquées).
5. **Mémoire / règles du projet** : `AI_RULES.md` + un fichier utilisateur global (`<userData>/CIMES.md`) injecté dans le prompt ; compatibilité de lecture de `CLAUDE.md`/`AGENTS.md` de l'app si présents.
6. **MCP** : confirmer que l'ajout d'un serveur MCP stdio fonctionne sans Pro et sous Windows (`rules/windows-spawn.md`), consentement par outil.
7. **Annulation et sécurité** : bouton Stop interrompt requête modèle, `web_fetch` et `run_shell` (kill de l'arbre de processus sous Windows) ; aucune action « modifiesState » en mode Ask/Plan.
8. **Proxy** : appels modèle/Albert via `net.fetch` (proxy et certificats Windows), cf. §3 — bloquant potentiel dans les établissements.
9. **Observabilité locale** : journaux d'agent (outil appelé, durée, refus de consentement) dans `logs/main.log`, jamais de clé ni de contenu de page ; export dans le rapport de bug existant.
10. **Évals** : petit jeu de 8–10 tâches rejouables (`testing/cimes-e2e/evals/`) : générer une app, utiliser un skill intégré, lire une page web, refuser une commande shell dangereuse, résister à une injection dans une page web. Sortie : tableau de succès par tâche ; l'exécuter après chaque changement de prompt.

### Critères d'acceptation supplémentaires

- Un skill Claude public (ex. un dossier tiers avec `SKILL.md` + `scripts/` + `references/`) copié tel quel dans `<userData>/skills/` est découvert, listé dans Paramètres, déclenché par l'agent sur une demande qui correspond, et ses références sont lues à la demande — sans modification du skill.
- Le prompt système ne contient que `name` + `description` (mesurer : < 150 tokens/skill).
- Aucune exécution de script sans passage par la revue + consentement ; zip-slip et traversée de chemin couverts par des tests.
- Les skills intégrés fonctionnent dans le paquet Windows (portable et installeur), pas seulement en dev.
- `AUTO_UPDATE_AVAILABLE`, `PAID_FEATURES_ENABLED`, `TELEMETRY_ENABLED` restent à `false` ; la clé Albert n'apparaît nulle part dans le dépôt ni les logs.
