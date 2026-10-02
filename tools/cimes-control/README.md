# cimes-control : piloter Cimes depuis Codex ou Claude Code

Serveur MCP (stdio) qui permet à un agent (Codex, Claude Code…) de **lancer, observer et commander** une application Cimes locale : naviguer, cliquer, saisir, envoyer une demande à l'agent de Cimes, lire la conversation, lire les journaux, prendre des captures d'écran. Il passe par le protocole DevTools d'Electron (`--remote-debugging-port`).

> **Sécurité** : le port de débogage donne le contrôle total de l'application à tout programme local. Il est désactivé par défaut dans Cimes. À utiliser sur **votre propre machine**, jamais sur un poste partagé d'établissement. Utilisez un profil jetable (`user_data_dir`) pour les tests.

## Installation

Depuis la racine du dépôt (Node ≥ 20) : `npm ci` (le serveur utilise `@modelcontextprotocol/sdk` et `playwright`, déjà dépendances du projet).

### Claude Code

Le fichier `.mcp.json` à la racine du dépôt déclare le serveur ; Claude Code demande de l'approuver au premier usage. Ou : `claude mcp add cimes-control -- node tools/cimes-control/server.mjs`.

### Codex

Dans `~/.codex/config.toml` (ou `.codex/config.toml` d'un projet de confiance) :

```toml
[mcp_servers.cimes-control]
command = "node"
args = ["tools/cimes-control/server.mjs"]
cwd = "C:/chemin/vers/Cime"   # racine du dépôt
```

## Outils

| Outil                            | Rôle                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `cimes_launch`                   | Lance `Cimes.exe` avec un port DevTools et un profil isolé, puis s'y connecte                            |
| `cimes_attach`                   | Se connecte à un Cimes déjà lancé avec `--remote-debugging-port=9333`                                    |
| `cimes_status`                   | URL, onboarding visible, boîte de consentement en attente                                                |
| `cimes_screenshot`               | Capture d'écran (renvoyée en image et enregistrée)                                                       |
| `cimes_navigate`                 | Ouvre une page du menu : `/`, `/settings`, `/library`, `/templates`, `/documents`, `/skills`, `/plugins` |
| `cimes_text` / `cimes_read_chat` | Texte visible de la page                                                                                 |
| `cimes_click` / `cimes_type`     | Cliquer / remplir (sélecteur CSS ou `text=…`)                                                            |
| `cimes_connect_albert`           | Termine l'écran de première connexion avec une clé Albert                                                |
| `cimes_send_prompt`              | Envoie un message à l'agent et attend la fin ; signale les demandes de consentement                      |
| `cimes_read_logs`                | Fin de `logs/main.log` (requêtes modèle, outils, erreurs) avec filtre regex                              |
| `cimes_eval`                     | Exécute une expression JavaScript dans l'interface (débogage)                                            |
| `cimes_close`                    | Déconnecte et arrête l'application si elle a été lancée par le serveur                                   |

Pour une version de développement : lancer `npm start -- --remote-debugging-port=9333` soi-même, puis `cimes_attach`.

## Notes

- Les captures vont dans le dossier temporaire (`CIMES_CONTROL_SHOTS` pour le changer).
- La clé Albert n'est jamais écrite par ce serveur dans un fichier ni dans les journaux ; elle est tapée dans l'application.
- Variables de test utiles (voir `testing/cimes-e2e/README.md`) : `CIMES_E2E=1`, `CIMES_E2E_BASE_URL`, `CIMES_E2E_MODEL` pour viser un autre point d'accès compatible OpenAI.
