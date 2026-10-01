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
