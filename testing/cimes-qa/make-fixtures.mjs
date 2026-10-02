// Regenerates the sample documents used by the QA campaign (small, fictional).
// node testing/cimes-qa/make-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  markdownToDocx,
  csvToXlsx,
  jsonToPptx,
} from "../../src/skills/builtin-assets/office.mjs";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
fs.mkdirSync(out, { recursive: true });

await markdownToDocx(
  `# Règlement de l'atelier de Cayenne

## Tablettes numériques
Les tablettes doivent être rendues avant **16 h 30** dans le casier numéro 7. Toute tablette non rendue entraîne une retenue de caution de 20 euros. La clé du casier est confiée à Mme Tiphaine.

## Accueil
Les participants arrivent à 8 h 30. Le café est offert dans la salle commune.
`,
  path.join(out, "reglement-atelier.docx"),
  { title: "Règlement de l'atelier" },
);

fs.writeFileSync(
  path.join(out, "notes.csv"),
  "Prénom;Classe;Note\nAwa;6eB;14,5\nLéo;6eB;9\nMaëlle;5eA;17\nTiago;5eA;12,5\n",
);
await csvToXlsx(
  path.join(out, "notes.csv"),
  path.join(out, "notes-eleves.xlsx"),
);
fs.rmSync(path.join(out, "notes.csv"));

await jsonToPptx(
  [
    { title: "Les volcans", subtitle: "Exposé de 5e" },
    {
      title: "Comment naît un volcan ?",
      bullets: [
        "Le magma monte depuis le manteau",
        "La pression fait éruption par la cheminée",
        "La lave refroidit et forme un cône",
      ],
      notes: "Montrer la maquette.",
    },
  ],
  path.join(out, "expose-volcans.pptx"),
);

fs.writeFileSync(
  path.join(out, "guide-animaux.md"),
  "# Choisir un animal de compagnie\n\nLe chat est un félin domestique indépendant : il se contente de quelques minutes de jeu par jour. Le chien est un compagnon fidèle qui demande des promenades quotidiennes et beaucoup de présence. Pour un petit logement, un chat ou un rongeur conviennent mieux.\n",
);
fs.writeFileSync(
  path.join(out, "recette-gateau.txt"),
  "Gâteau au chocolat : mélanger 200 g de farine, 3 œufs, 150 g de sucre et 100 g de cacao, puis cuire 40 minutes au four à 180 degrés.\n",
);

// A one-page PDF with a text layer.
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  "<< /Length 80 >>\nstream\nBT /F1 14 Tf 20 100 Td (Le sentier du Mahury est ferme le lundi.) Tj ET\nendstream",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
];
let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, index) => {
  offsets.push(pdf.length);
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.writeFileSync(path.join(out, "sentier-mahury.pdf"), pdf);
console.log("Fixtures written to", out);
