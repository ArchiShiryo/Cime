# Feuille de route Cimes

État au 2 octobre 2026. Branche de travail : `claude/dyad-themes-ucuvhn`.
Légende : ✅ fait · 🔧 en cours · ⬜ à faire · ⏸ reporté volontairement.

## 1. Fait

- ✅ Albert (DINUM) comme fournisseur, clé demandée au premier lancement, modèles synchronisés avec l'API.
- ✅ Agent complet : web (recherche, lecture), shell avec consentement, plugins MCP, compétences (format Claude).
- ✅ Boîte à outils Office (Word, Excel, PowerPoint, lecture PDF) et **OCR hors ligne** (français + anglais).
- ✅ RAG local (modèle d'embeddings embarqué), global et **par projet**.
- ✅ **Projets** : 4 modèles d'organisation, conversations groupées, documentation RAG en un clic, compétences par projet.
- ✅ **Sources officielles** : data.gouv, annuaire des services publics, entreprises, adresses, BOAMP ; Légifrance via PISTE (non testé avec de vraies clés).
- ✅ **Traitement par lot** reprenable (un résultat par fichier, jamais d'écrasement).
- ✅ **Journal d'activité** (tours, outils, OCR, indexation) avec écran de consultation.
- ✅ Aucun contact avec les serveurs Dyad, aucune télémétrie, aucune offre payante visible.
- ✅ Interface en français (par défaut) et en anglais ; backend en anglais.
- ✅ **Personnalisation** : préférences de rédaction et mémoire (personnelle + par projet) ; **Projets** : renommer, supprimer, déplacer ; **Documents** : LibreOffice en lecture, export PDF.
- ✅ Corrections du rapport QA Windows (build `4859046`) : routes Documents/Skills, effort Ministral, catalogue Albert, Qwen retiré, verrous Office, erreurs 429, DNS `dyad.sh`, options Pro.

## 2. Avant le pilote (bloquant)

| #   | Point                                                  | Détail                                                                                                                                                                                                           |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ⬜ **Interface : anglais restant**                     | Accueil, chat (« Thought », « Questionnaire », « Undo », « Retry »), aperçu, en-tête (« No app selected »). Chaînes de Dyad codées en dur : lot de traduction dédié aux écrans que voient les agents.            |
| 2   | ⬜ **Build Windows + nouvelle passe QA (Codex)**       | Sur le dernier commit. À valider : routes, effort des modèles, verrous Office, DNS, OCR et lot sous Windows.                                                                                                     |
| 3   | ⬜ **Cas jamais testés**                               | Réseau verrouillé / proxy institutionnel, hors ligne complet, import de skills (zip-slip), commande shell longue et annulation, Légifrance avec de vraies clés PISTE, débit d'Albert sur un lot de 100 fichiers. |
| 4   | ⬜ **Clé Albert provisoire**                           | À révoquer (elle a circulé dans des conversations).                                                                                                                                                              |
| 5   | ⬜ **Fusion de la PR puis build propre depuis `main`** | Fait par le mainteneur.                                                                                                                                                                                          |
| 6   | ⬜ **Installateur**                                    | Vérifier l'alerte SmartScreen (signature) et l'installation sans droits administrateur.                                                                                                                          |
| 7   | ⬜ **Canal de mise à jour Cimes**                      | Les mises à jour sont désactivées : prévoir un canal avant de déployer sur 15 postes.                                                                                                                            |
| 8   | ⬜ **Décision Undo / Retry dans les projets**          | Boutons qui s'appuient sur git : les garder ou les masquer comme le versioning.                                                                                                                                  |

## 3. Prochain chantier : Personnalisation

Nouvelle section **Personnalisation** dans les Paramètres.

1. ✅ **Préférences de rédaction** : tutoiement ou vouvoiement, registre (administratif, pédagogique, courant), longueur des réponses, langue de rédaction des documents, formule de politesse et signature, service et fonction. Injectées dans les consignes de chaque conversation.
2. ✅ **Mémoire** :
   - mémoire **personnelle** (partagée entre projets) et mémoire de **projet** (dans le dossier du projet, elle le suit) ;
   - un fichier Markdown par souvenir + un index court chargé au début des conversations ;
   - outils pour l'agent : enregistrer, lire, oublier ;
   - écran « Mémoire » pour voir, corriger et effacer ;
   - enregistrement **sur demande ou avec validation** (jamais silencieux) ;
   - garde-fou : aucune donnée personnelle d'usager ou d'élève dans un souvenir ;
   - remplace le plugin « Memory » (qui dépend de `npx`).

## 3 bis. Version nightly (expérimental, jamais dans la version stable)

Prérequis : un canal « nightly » distinct (build, nom, dossier de données, mise à jour) et un bandeau visible « version expérimentale ».

- ⬜ **OpenRouter pour les sous-agents** : nouveau fournisseur réservé à la nightly, choisi par sous-agent (jamais pour l'agent principal par défaut). Avertissement permanent : les données quittent le circuit Albert ; activation explicite par projet.
- ⬜ **Pilotage à distance par un ChatGPT ou un Claude en ligne** : l'employé continue à travailler en déplacement depuis son assistant (application web ou mobile) qui pilote Cimes sur son poste. Piste : serveur MCP distant exposé par Cimes (tunnel sortant, jamais de port ouvert), authentification forte, périmètre limité à un projet, consentement pour chaque action sensible, aucun shell à distance par défaut, journal de tout ce qui est demandé.
- ⬜ **Orchestrateur + sous-agents Albert** : un modèle « cerveau » planifie, plusieurs sous-agents Albert exécutent (lecture, extraction, rédaction, lot). Variante 100 % souveraine d'abord (grand modèle Albert en orchestrateur, petits modèles Albert en exécutants) ; variante avec modèle frontier ensuite.
- ⬜ **Garde-fou de données (condition de tout ce qui précède)** : niveau de sensibilité par projet (le niveau « confidentiel » interdit tout modèle hors Albert), pseudonymisation locale avant tout envoi hors Albert, le modèle externe ne reçoit que des instructions et des résultats synthétiques (jamais les documents), journal de ce qui est sorti du poste.

## 4. Ensuite

- ✅ Projets : renommer, supprimer avec confirmation, déplacer une conversation vers un projet.
- ✅ Formats LibreOffice (.odt, .ods, .odp) en lecture et export PDF (md2pdf, docx2pdf).
- ⬜ Lecture de mails (.eml, .msg) et d'images en entrée (si le modèle les accepte).
- ⬜ Partage : export/import d'un projet en un fichier, bibliothèque de skills sur un dossier réseau.
- ⬜ Connecteurs supplémentaires : Tchap, La Suite numérique (Docs, Grist).
- ⬜ Accessibilité de l'application (RGAA) et contrôle d'accessibilité des documents produits.
- ⬜ Recherche dans l'historique de toutes les conversations.
- ⬜ Benchmark contrôlé des modèles Albert (dix tâches, médianes de latence).
- ⬜ « Créer une skill à partir d'un exemple » et dossier de skills privées (allégé volontairement).

## 5. Reporté volontairement

- ⏸ **Fichier de politique DSI** (verrouiller modèle, shell, web ; préremplir clé et proxy) : pas prioritaire pour l'instant.
- ⏸ **Tâches guidées** (« Rédiger une note », « Synthétiser un rapport ») : pas pour l'instant.
- ⏸ **Tâches planifiées** : trop fragiles sur des postes qui s'éteignent.
- ⏸ **OCR de l'écriture manuscrite** : hors de portée de la solution embarquée.
