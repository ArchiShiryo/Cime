# Tests de bout en bout de Cimes (Linux, application compilée)

Ces scripts lancent l'application **empaquetée** (`out/Cimes-linux-x64/Cimes`) dans un profil
temporaire, la pilotent par le protocole Chrome DevTools (les « fuses » d'Electron interdisent
l'inspection classique) et enregistrent des captures d'écran.

Prérequis : `npm run package` (après `npm rebuild dugite`), `xvfb-run`, ImageMagick (`import`).
La clé Albert est lue dans la variable `ALBERT_KEY_FOR_TEST` (jamais dans un fichier).

```sh
# Parcours de base : démarrage, clé invalide/valide, thème, redémarrage
ALBERT_KEY_FOR_TEST=... E2E_HOME=$(mktemp -d) \
  xvfb-run -a -s "-screen 0 1400x900x24" node testing/cimes-e2e/smoke.mjs out/Cimes-linux-x64/Cimes
E2E_PHASE=restart E2E_HOME=<le même dossier> \
  xvfb-run -a -s "-screen 0 1400x900x24" node testing/cimes-e2e/smoke.mjs out/Cimes-linux-x64/Cimes

# Tour d'agent réel (recherche web, lecture de page, shell)
ALBERT_KEY_FOR_TEST=... AGENT_TIMEOUT_S=420 \
AGENT_PROMPT="Cherche sur le web la dernière version stable de React, lis la page officielle, puis exécute la commande node -v dans le shell." \
  xvfb-run -a -s "-screen 0 1400x900x24" node testing/cimes-e2e/agent.mjs out/Cimes-linux-x64/Cimes
```

Dans le bac à sable de développement, le réseau passe par un proxy : ajouter
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` (inutile sur un poste normal).
`agent.mjs` a été exécuté avec succès sur l'application empaquetée (voir plus bas).
consentement, détection de fin de réponse).

## Modèle de test sans clé Albert

Pour tester l'agent contre un autre point d'accès compatible OpenAI (par exemple l'API DeepSeek, nom de modèle `deepseek-flash`) :

```sh
CIMES_E2E=1 CIMES_E2E_BASE_URL=https://api.deepseek.com/v1 CIMES_E2E_MODEL=deepseek-flash \
ALBERT_KEY_FOR_TEST=une-valeur APP_EXTRA_ARGS="--ignore-certificate-errors" \
MCP_SEED_JSON='{"name":"memoire","command":"npx","args":["-y","@modelcontextprotocol/server-memory@2026.8.31"]}' \
AGENT_PROMPT="..." xvfb-run -a node testing/cimes-e2e/agent.mjs out/Cimes-linux-x64/Cimes
node testing/cimes-e2e/skills.mjs out/Cimes-linux-x64/Cimes   # Paramètres > Skills et catalogue de plugins
```

`APP_EXTRA_ARGS="--ignore-certificate-errors"` n'est nécessaire que derrière un proxy qui remplace les certificats (bac à sable). `agent.mjs` a été exécuté avec succès (recherche web, lecture de page, shell, skill, MCP).
