# Fork « Albert Guyane » — rapport

## Ce qui a été fait

Dyad + Albert (DINUM) intégré, avec un onboarding qui ne demande que la clé API.

- **Fournisseur** : créé automatiquement comme _fournisseur personnalisé_ `custom::albert`
  (nom « Albert - DINUM », base `https://albert.api.etalab.gouv.fr/v1`, variable `ALBERT_API_KEY`).
  Choix volontaire par rapport à un fournisseur « builtin » : aucun changement dans
  `get_model_client.ts`, le chemin OpenAI-compatible existant est réutilisé.
- **Modèle** : `deepseek-v4-flash-0731` (« DeepSeek V4 Flash - Albert »),
  `context_window = 131072`, `max_output_tokens = 8192`.
- **Idempotence / migration** : `ensureAlbertProvider()` s'exécute au démarrage et avant
  chaque connexion. Elle crée ou met à jour le fournisseur et le modèle, corrige les limites
  d'un modèle déjà présent et supprime les doublons.
- **Validation de la clé** : `GET /v1/models` avec `Authorization: Bearer <clé>`.
  Succès uniquement si HTTP 200 **et** `deepseek-v4-flash-0731` est listé.
  Messages distincts : clé invalide (401/403), Albert injoignable, modèle absent, limite de débit.
  La saisie est conservée en cas d'erreur.
- **Stockage de la clé** : `settings.providerSettings["custom::albert"].apiKey`, chiffrée par
  `safeStorage` via l'infrastructure existante (`writeSettings`). Aucune clé dans le dépôt,
  le build ou les logs (les logs `[Albert] …` n'écrivent jamais la clé).
- **Sélection** : après validation, `selectedModel = custom::albert / deepseek-v4-flash-0731`.
- **UI** : écran « Connecter Albert » au premier lancement (si aucun fournisseur n'est configuré),
  section « Albert » dans Paramètres (état, tester, modifier, déconnecter).
  Lien « Utiliser un autre fournisseur » pour garder le Dyad d'origine. Désactivé en mode test E2E.
- **Build Windows portable** : `MakerZIP` activé pour `win32` + workflow GitHub Actions
  `build-windows-portable.yml` (portable ZIP + Setup.exe).

## Fichiers

Nouveaux : `src/shared/albert.ts`, `src/ipc/services/albert_service.ts`,
`src/ipc/handlers/albert_handlers.ts`, `src/ipc/types/albert.ts`, `src/hooks/useAlbert.ts`,
`src/components/AlbertOnboarding.tsx`, `src/components/AlbertSettings.tsx`,
`.github/workflows/build-windows-portable.yml`, tests `albert_service.test.ts` et
`albert_provider.db.test.ts`.
Modifiés : `src/ipc/ipc_host.ts`, `src/ipc/preload/channels.ts`, `src/ipc/types/index.ts`,
`src/lib/queryKeys.ts`, `src/main.ts`, `src/app/layout.tsx`, `src/pages/settings.tsx`,
`forge.config.ts`.

## Node.js (documentation, non modifié)

Détection / installation de Node : `src/ipc/handlers/node_handlers.ts` (handler `nodejs-status`,
téléchargement du `.msi` si Node est absent). Un chemin Node configurable existe déjà dans
les paramètres (`nodePath`). Pour embarquer un Node portable plus tard, c'est ici qu'il faudra
brancher le chemin du Node embarqué.

## Construire le Windows

Sur GitHub : onglet _Actions_ → « Build Windows (portable + installer) » → _Run workflow_.
Récupérer `windows-portable-zip` (dézipper et lancer l'exécutable) et `windows-installer`.

En local sur un poste Windows (Node >= 24) :

```sh
npm ci
npm run make
# ZIP portable : out/make/zip/win32/x64/*.zip
# Installeur   : out/make/squirrel.windows/x64/*Setup.exe
```

## Vérifié / non vérifié

Vérifié :

- `npm run ts`, lint, `npm run fmt`.
- Service : validation de la clé (200 + modèle, 401, réseau coupé, modèle absent, clé vide),
  aucune fuite de la clé dans les messages, rien n'est enregistré si la validation échoue.
- Base SQLite réelle : création, idempotence, réparation d'un modèle réglé à 131072 tokens de
  sortie, suppression des doublons.
- **Test E** : pour `custom::albert / deepseek-v4-flash-0731`, `getMaxTokens` renvoie 8192 et
  `getContextWindow` 131072 (les valeurs que Dyad passe à la requête).
- Composants : écran « Connecter Albert » et section Paramètres testés (Vitest + Testing Library)
  et rendus dans Chromium avec le vrai CSS (IPC simulé) : saisie masquée, erreur avec saisie
  conservée, confirmation, tester / modifier / déconnecter.
- API Albert réelle : `/v1/models` → 200 avec le modèle listé, mauvaise clé → 401,
  chat completion `deepseek-v4-flash-0731` avec `max_tokens: 8192` → 200.

Non vérifié (nécessite l'application packagée sous Windows) : premier lancement réel (test A),
redémarrage (test D), génération complète d'une application avec preview (test F).

## Nom et branding : Cimes

Le produit s'appelle **Cimes** (jeu de mots avec Canopé). Le logo est le logotype vectoriel CANOPÉ
extrait du modèle institutionnel (`assets/logo.svg`).

- Affichage : `productName` (`package.json`), titre de fenêtre (`index.html`), barre de titre,
  écran de saisie de la clé, nom du protocole (`forge.config.ts`), installeur
  (`Cimes-Setup.exe`). Constantes dans `src/shared/branding.ts`.
- Volontairement inchangés : nom du paquet `dyad`, schéma d'URL `dyad://`, dépôt, identifiants internes.
- **Mise à jour automatique désactivée** (`AUTO_UPDATE_AVAILABLE = false`) : le serveur de mise à jour
  par défaut distribue le Dyad officiel et remplacerait Cimes. Pour mettre à jour un poste, installer
  la nouvelle version issue du workflow de build Windows. Réactiver ce drapeau seulement avec un flux
  de mise à jour propre à Cimes.
- Le dossier de données Windows suit `productName` : `%APPDATA%\Cimes`.

## Écran de démarrage

Fenêtre sans cadre (900x560) affichée dès le lancement. La fenêtre principale ne la remplace que lorsque
l'interface signale qu'elle est réellement rendue (`splash:renderer-ready`), avec 2,5 s minimum,
un secours 8 s après le chargement de la page et 30 s au maximum. Contenu : logo Réseau Canopé et slogan, logo Cimes /
Déploiement Albert, panorama de Guyane, une ligne de texte et une barre de progression.

- Code : `src/splash/` (`splash_html.ts`, `splash_window.ts`) ; images dans `src/splash/assets/`
  (WebP, environ 225 Ko), intégrées en base64 au build : l'écran ne dépend d'aucun fichier externe
  (le dossier `assets/` n'est pas inclus dans l'application empaquetée).
- Actif seulement pour l'application empaquetée hors build de test : le mode dev et les tests E2E
  gardent l'ouverture directe.
- Les visuels viennent de `CIMES_assets_visuels.zip`. Les cartes d'installation et de fonctionnalités
  du zip ne sont volontairement pas utilisées.

## Installeur

L'animation affichée par Squirrel pendant l'installation est remplacée par `assets/installer/cimes-installing.gif`
(même visuel que l'écran de démarrage, « Installation de Cimes… »).

## Offres payantes et télémétrie

- `PAID_FEATURES_ENABLED = false` (`src/shared/branding.ts`) : aucune offre, lien ou bannière Dyad Pro,
  pas de fournisseur « Dyad » payant, pas de génération d'images, d'annotateur ni de sandbox cloud
  (fonctions Pro), et **pas de quota de 20 messages/jour** sur le mode Agent.
- `TELEMETRY_ENABLED = false` : PostHog est initialisé désactivé (aucun appel réseau, aucun script
  externe), tout événement est jeté ; bannière de consentement et section Télémétrie masquées. Les
  rapports de plantage restent locaux. Restent des téléchargements de catalogues/modèles depuis
  api.dyad.sh, sans donnée d'usage.

## Onboarding Albert

Obligatoire tant qu'aucune clé n'est enregistrée dans Cimes, même si d'autres fournisseurs ou une
variable `ALBERT_API_KEY` existent (`src/lib/albertOnboarding.ts`).

## Thème

Thème clair Canopé par défaut ; bascule clair/sombre en bas de la barre latérale.

## Accès web et shell de l'agent (sans Dyad Pro)

Dans Dyad, la recherche web, la lecture de pages et le shell passent par le serveur payant de Dyad
(ou une relecture OpenAI). Cimes les remplace par des versions locales.

- **Lecture de pages** (`web_fetch`, `tools/local_web.ts`) : téléchargement via `net.fetch` d'Electron (proxy
  système et certificats de Windows), puis extraction de l'article (`@mozilla/readability`, Apache-2.0),
  conversion en Markdown (`turndown`, MIT) avec un DOM léger (`linkedom`, ISC). Taille limitée à 2,5 Mo,
  redirections suivies avec cookies, **adresses locales et privées refusées** (localhost, 192.168.x, 10.x,
  169.254.x, IPv6 locales, redirections et résolutions DNS comprises), schémas autres que http/https refusés.
- **Recherche web** (`web_search`, `tools/local_web_search.ts`) : DuckDuckGo (HTML), puis Bing en repli, sans
  clé. Un serveur **SearXNG** peut être indiqué dans Paramètres > IA pour des résultats plus fiables.
  Limite connue : ces moteurs limitent parfois les connexions partagées (réseau d'établissement, serveurs
  cloud) ; le message d'erreur l'explique à l'agent.
- **Contenu non fiable** : tout texte venu du web est encadré par `<untrusted_web_content>` avec la consigne de ne
  jamais suivre les instructions qu'il contient.
- **Shell** (`run_shell`) : actif par défaut, sans Pro. PowerShell sous Windows, Bash ailleurs, sans profil,
  60 s par défaut, 5 min au maximum. Chaque commande est relue par **le modèle sélectionné** (DeepSeek via
  Albert, au lieu du modèle OpenAI imposé en amont) puis **soumise à votre validation** (consentement
  « Ask » par défaut). Réglable dans Paramètres > Expériences et Autorisations de l'agent.
- Non repris : `web_crawl` (clonage de sites), génération d'images, recherche de code assistée et sous-agents
  (services payants de Dyad).

## Limites

- Fournisseur `custom::albert` plutôt que `albert` : sans effet visible pour l'utilisateur.
- L'URL du lien « Où trouver ma clé ? » (`https://albert.sites.beta.gouv.fr/`) est à confirmer.
- Icône Cimes (lettre « C » du logo CANOPÉ sur fond turquoise) : `assets/icon/logo.ico` (Windows, 7 tailles) et `logo.png` (Linux). `logo.icns` (macOS) est resté celui de Dyad.

## Skills (compatibles Claude) et MCP

- **Skills** (`src/skills/`) : un skill est un dossier avec un `SKILL.md` (frontmatter `name` + `description`, champs inconnus ignorés). Sources, de la plus faible à la plus forte priorité : skills intégrés (21, `src/skills/builtin/`), `<userData>/skills/`, `<app>/.claude/skills/`, `<app>/.cimes/skills/`. Le prompt n'embarque que les noms et descriptions ; l'outil `read_skill` charge le contenu et les fichiers du skill (confinés à son dossier). `/nom-du-skill args` charge un skill à la main. Les scripts passent par `run_shell` (relecture + accord). `allowed-tools` est lu mais sans effet. Gestion dans Paramètres > IA > Skills (activer/désactiver, importer un dossier ou un .zip/.skill, supprimer).
- **MCP** : fonctionne sans Dyad Pro (serveurs stdio via npx et HTTP). Le catalogue de la page Plugins est **embarqué** (`src/ipc/shared/bundled_mcp_catalog.ts` : Context7, Mémoire, Raisonnement pas à pas, Playwright, versions épinglées, vérifiés) : plus aucun appel à api.dyad.sh. Chaque appel d'outil demande l'accord de l'utilisateur. L'expérience « scripts en bac à sable » est désactivée par défaut : DeepSeek utilise mieux les outils MCP enregistrés directement. Node.js doit être installé sur le poste pour les serveurs `npx`.
- **Réseau** : les appels au modèle (fournisseur personnalisé, donc Albert) et la validation de la clé passent par la pile réseau d'Electron (proxy et certificats du système), comme les outils web.

## Vérifié sur l'application empaquetée (Linux, DeepSeek réel)

Via `testing/cimes-e2e/agent.mjs` contre l'API DeepSeek (variables de test `CIMES_E2E*`, voir README du dossier) : réponse + création d'un fichier ; recherche web + lecture de page + `node -v` dans le shell avec validation ; chargement d'un skill intégré par le modèle ; appel d'un serveur MCP (Mémoire) enregistrant puis relisant des données. `skills.mjs` : liste des skills, bascule, import, catalogue de plugins. **Non vérifié** : Windows (PowerShell, proxy réel, npx), prévisualisation d'une app complète (le pnpm du bac à sable est trop lent), modèle Albert réel (nom `deepseek-v4-flash-0731`).

## Modèles Albert

- Modèles préconfigurés dès le premier lancement (identifiants du guide Albert) : `deepseek-v4-flash-0731` (par défaut), `gpt-oss-120b`, `mistral-medium-2508`, `mistral-small-3-2-24b-instruct-2506`, `ministral-3-8b-instruct-2512`, `qwen3-coder-30b-a3b-instruct` (`src/shared/albert.ts`).
- À la connexion de la clé et au bouton « Tester », Cimes lit `GET /v1/models` et ajoute tous les modèles de génération de texte que la clé peut utiliser, avec leur fenêtre de contexte (`src/shared/albert_models.ts`). Les modèles qui disparaissent de la liste ne sont pas supprimés.
- Sélecteur de modèles : seuls Albert et les fournisseurs dont l'utilisateur a saisi une clé sont proposés ; plus de lignes d'abonnement Claude/ChatGPT ni de modèles verrouillés.
- **Non vérifié** : le comportement des modèles autres que DeepSeek avec les outils de l'agent (appel d'outils, shell, MCP). À tester avec une vraie clé, en commençant par GPT-OSS et Mistral Medium.

## Fichiers Office (Word, Excel, PowerPoint) sur un PC verrouillé

Le skill intégré `office-fichiers` livre un script Node unique (`office.mjs`, ~1,9 Mo, sans dépendance ni installation, hors ligne) écrit dans `<userData>/builtin-skills/office-fichiers/scripts/`. Commandes : `read`, `md2docx`, `csv2xlsx`, `xlsx2csv`, `json2pptx`, `replace` (remplacement qui garde la mise en forme, y compris texte coupé en plusieurs « runs »). Le même fichier est une bibliothèque (`docx`, `ExcelJS`, `PptxGenJS`, `mammoth`, `JSZip`) pour les scripts écrits par l'agent. Les commandes passent par le shell de l'agent (relecture + accord).

- Sources : `tools/office-bundle/` (`npm install && npm run build` régénère `src/skills/builtin-assets/office.mjs`, exclu de fmt et lint).
- Vérifié : test unitaire qui exécute vraiment le script (création, remplacement, relecture) ; tour d'agent réel sur l'application empaquetée (skill chargé, .docx créé et relu).
- Limites : pas d'aperçu ni de conversion PDF, pas de .doc/.xls/.ppt anciens, macros et graphiques Excel existants non conservés à la réécriture, pas de lecture de PDF. Les fichiers générés n'ont pas pu être ouverts dans Word/LibreOffice ici (LibreOffice inutilisable dans le bac à sable) : à ouvrir dans Office sur un vrai poste.
- Prérequis : `node` accessible depuis le shell de l'agent (Cimes utilise son Node géré ou celui du système).
