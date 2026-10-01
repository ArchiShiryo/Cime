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

Fenêtre sans cadre (900x560) affichée au lancement, puis remplacée par la fenêtre principale une fois
le rendu prêt (2 s minimum, 20 s maximum). Contenu : logo Réseau Canopé et slogan, logo Cimes /
Déploiement Albert, panorama de Guyane, une ligne de texte et une barre de progression.

- Code : `src/splash/` (`splash_html.ts`, `splash_window.ts`) ; images dans `src/splash/assets/`
  (WebP, environ 225 Ko), intégrées en base64 au build : l'écran ne dépend d'aucun fichier externe
  (le dossier `assets/` n'est pas inclus dans l'application empaquetée).
- Actif seulement pour l'application empaquetée hors build de test : le mode dev et les tests E2E
  gardent l'ouverture directe.
- Les visuels viennent de `CIMES_assets_visuels.zip`. Les cartes d'installation et de fonctionnalités
  du zip ne sont volontairement pas utilisées.

## Limites

- Fournisseur `custom::albert` plutôt que `albert` : sans effet visible pour l'utilisateur.
- L'URL du lien « Où trouver ma clé ? » (`https://albert.sites.beta.gouv.fr/`) est à confirmer.
- Icône Cimes (lettre « C » du logo CANOPÉ sur fond turquoise) : `assets/icon/logo.ico` (Windows, 7 tailles) et `logo.png` (Linux). `logo.icns` (macOS) est resté celui de Dyad.
