---
name: office-fichiers
description: Lire, créer et modifier des fichiers Word (.docx), Excel (.xlsx) et PowerPoint (.pptx) sans Microsoft Office, avec une boîte à outils Node fournie (aucune installation, fonctionne hors ligne sur un PC verrouillé). À utiliser dès que l'utilisateur mentionne un fichier Word, Excel, PowerPoint, un tableau, un compte rendu, un diaporama, un publipostage ou veut modifier un document existant.
---

# Fichiers Word, Excel et PowerPoint

Tout passe par un seul script Node : `office.mjs`, dans le dossier de ce skill (le chemin exact est donné par `read_skill`, ligne « The skill folder is »). Il fonctionne avec le Node déjà utilisé par Cimes, **sans `npm install` ni accès internet**. Lance-le avec l'outil shell : `node "<dossier>/scripts/office.mjs" <commande> ...` (l'utilisateur est averti avant chaque commande).

## Règles d'or

1. **Ne jamais écraser l'original** : écrire dans un nouveau fichier (`nom-v2.docx`) et dire où il se trouve. Les fichiers de l'utilisateur ne sont pas dans le dossier de l'application : demander le chemin complet si besoin.
2. **Lire avant de modifier** (`read`), puis **relire le résultat** pour vérifier.
3. Formats pris en charge : `.docx`, `.xlsx`, `.pptx`. Les anciens `.doc`, `.xls`, `.ppt` : demander à l'utilisateur de les « Enregistrer sous » au format récent.
4. Pas de rendu visuel possible (pas d'aperçu, pas de PDF) : décrire ce qui a été produit et inviter l'utilisateur à ouvrir le fichier pour vérifier la mise en page.
5. Données de personnes (élèves, stagiaires) : voir `donnees-eleves-rgpd`.

## Commandes

```
node office.mjs read fichier.docx|xlsx|pptx            # docx : Markdown ; xlsx/pptx : JSON (feuilles, diapos, notes)
node office.mjs md2docx entree.md sortie.docx [titre]  # Markdown -> Word (titres, listes, gras/italique, tableaux)
node office.mjs csv2xlsx entree.csv sortie.xlsx        # CSV (; ou ,) -> Excel, en-tête en gras, colonnes ajustées
node office.mjs xlsx2csv entree.xlsx sortie.csv [feuille]
node office.mjs json2pptx diapos.json sortie.pptx      # [{"title","subtitle","bullets":[],"text","notes"}]
node office.mjs replace fichier remplacements.json sortie   # {"ancien":"nouveau"} : garde la mise en forme
```

`replace` fonctionne sur .docx (corps, en-têtes, pieds de page), .pptx (diapos et notes) et .xlsx (textes). Idéal pour **remplir un modèle** : garder le fichier modèle, remplacer des repères comme `{{NOM}}`.

## Quand les commandes ne suffisent pas : écrire un script

Le même fichier est aussi une **bibliothèque**. Créer un script `.mjs` (dans le dossier du projet, jamais dans le dossier du skill) :

```js
import {
  docx,
  ExcelJS,
  PptxGenJS,
  mammoth,
  JSZip,
} from "<dossier>/scripts/office.mjs";
```

- **Word** (`docx`) : `new docx.Document({ sections: [{ children: [new docx.Paragraph(...), new docx.Table(...)] }] })`, puis `docx.Packer.toBuffer(doc)` et `fs.writeFileSync`. Pieds de page, numéros de page (`docx.PageNumber.CURRENT`), images (`docx.ImageRun`), styles de titres, orientation paysage, sections.
- **Excel** (`ExcelJS`) : `const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(f)` pour ouvrir un classeur **en conservant ses formats**, modifier `sheet.getCell("B2").value = ...`, formules `{ formula: "SUM(B2:B10)" }`, formats de nombre (`numFmt: "0.00 €"`), largeurs, couleurs, validation de données, mise en forme conditionnelle, graphiques non pris en charge. Puis `await wb.xlsx.writeFile(sortie)`.
- **PowerPoint** (`PptxGenJS`) : `pptx.addSlide()`, `addText`, `addImage`, `addTable`, `addChart` (graphiques natifs), `addNotes`. Pour modifier un .pptx existant, préférer `replace` ; pour changer sa structure, `JSZip` permet d'éditer le XML (diapo = `ppt/slides/slideN.xml`).
- **Lecture** : `mammoth.convertToMarkdown({ path })` (Word) ; `ExcelJS` (Excel).

## Charte Canopé (si demandé)

Fond `#F4EFED`, turquoise `#005A5B` (titres, en-têtes), sauge `#94A088` (accents), texte `#222222`. Police Calibri/Arial (Marianne n'est souvent pas installée sur les postes). Détails : skill `charte-canope`. Pour une présentation institutionnelle exacte (masques officiels), partir du modèle .potx de l'utilisateur et utiliser `replace`.

## Pièges connus

- Une cellule Excel avec formule n'a pas de valeur calculée tant que le fichier n'est pas ouvert dans Excel : ne pas annoncer de résultats chiffrés issus d'une formule sans les avoir calculés soi-même.
- Les macros (.xlsm, .docm), commentaires de révision, suivi des modifications et graphiques Excel existants peuvent être perdus si le fichier est réécrit avec `ExcelJS` : le dire à l'utilisateur et travailler sur une copie.
- Mots coupés en plusieurs « runs » : `replace` gère ce cas ; un script maison doit fusionner les runs d'un paragraphe.
- Les accents et l'UTF-8 sont gérés ; pour un CSV destiné à Excel français, utiliser `;` (c'est ce que fait `xlsx2csv`).
