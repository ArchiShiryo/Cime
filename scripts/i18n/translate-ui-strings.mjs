// Translates the English UI strings (src/i18n/ui_strings_en.json) into French and keeps
// them in src/i18n/ui_fr.json (English text -> French text). Incremental: only strings
// missing from ui_fr.json are sent. Review the diff before committing.
// Usage: node scripts/i18n/translate-ui-strings.mjs
// Env: I18N_API_URL (default https://api.deepseek.com/v1/chat/completions),
//      I18N_API_KEY (optional when a proxy injects credentials), I18N_MODEL (default deepseek-flash)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SRC = path.join(root, "src/i18n/ui_strings_en.json");
const OUT = path.join(root, "src/i18n/ui_fr.json");
const URL_ =
  process.env.I18N_API_URL || "https://api.deepseek.com/v1/chat/completions";
const MODEL = process.env.I18N_MODEL || "deepseek-flash";

const SYSTEM = `Tu traduis les textes d'une interface logicielle (anglais -> français) pour Cimes, un assistant IA destiné aux agents de la fonction publique française.
Règles : vouvoiement ; ton clair, sobre, institutionnel ; français de France ; boutons à l'infinitif ou impératif court (« Enregistrer », « Annuler »).
Les textes sont souvent des FRAGMENTS d'une phrase coupée par des variables : traduis le fragment tel quel, sans le compléter, en gardant la ponctuation et les espaces de début/fin significatifs (virgule, point, deux-points).
Conserve exactement : noms de produits et de technologies (GitHub, Supabase, Vercel, Neon, Cloudflare, Coolify, Git, npm, Node.js, MCP, API, URL), code entre backticks, chemins, extensions, variables, emojis, nombres. Remplace la marque "Dyad" par "Cimes".
Glossaire : app/application -> application ; chat -> conversation ; prompt -> consigne ; commit -> enregistrement (commit) ; branch -> branche ; deploy -> déployer ; preview -> aperçu ; plan -> plan ; Agent -> Agent ; Ask -> Question ; Build -> Construction ; Settings -> Paramètres ; Library -> Bibliothèque ; Templates -> Modèles ; Theme -> Thème ; Undo -> Annuler ; Retry -> Réessayer ; Back -> Retour ; Next -> Suivant ; Submit -> Envoyer ; Approve -> Approuver ; Questionnaire -> Questionnaire.
Réponds UNIQUEMENT par un objet JSON {"texte anglais exact":"traduction",...} avec exactement les mêmes clés.`;

const tokens = (s) =>
  (String(s).match(/`[^`]*`|\d+|https?:\/\/\S+|\{[^}]*\}/g) ?? [])
    .sort()
    .join("|");

async function call(batch) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(URL_, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.I18N_API_KEY
            ? { Authorization: `Bearer ${process.env.I18N_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 24000,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify(
                Object.fromEntries(batch.map((s) => [s, s])),
              ),
            },
          ],
        }),
      });
      const text = (await res.json()).choices?.[0]?.message?.content ?? "";
      const json = JSON.parse(
        text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
      );
      const out = {};
      let bad = 0;
      for (const s of batch) {
        const fr = json[s];
        if (
          typeof fr !== "string" ||
          !fr.trim() ||
          tokens(fr) !== tokens(s) ||
          /\bDyad\b/.test(fr)
        )
          bad++;
        else out[s] = fr;
      }
      if (bad === 0 || attempt === 3) return out;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
}

const en = JSON.parse(fs.readFileSync(SRC, "utf8"));
const have = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const todo = en.filter((s) => !(s in have));
console.log(
  `${todo.length} to translate (${Object.keys(have).length} already done)`,
);
const batches = [];
for (let i = 0; i < todo.length; i += 70) batches.push(todo.slice(i, i + 70));
let next = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < batches.length) {
      const i = next++;
      Object.assign(have, await call(batches[i]));
      process.stderr.write(`batch ${i + 1}/${batches.length}\n`);
    }
  }),
);
const sorted = Object.fromEntries(
  Object.entries(have)
    .filter(([k]) => en.includes(k))
    .sort(([a], [b]) => a.localeCompare(b)),
);
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
const missing = en.filter((s) => !(s in sorted));
console.log(
  `done: ${Object.keys(sorted).length} translated, ${missing.length} left in English`,
);
