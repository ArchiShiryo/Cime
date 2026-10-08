// Packaged-app check of the new features: OCR in the project RAG, official data, batch processing, activity log.
// Needs the CIMES_E2E_* endpoint override (e.g. DeepSeek) and network access to the public APIs.
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const exe = process.argv[2];
const home = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-projects-e2e-"));
const shots = process.env.E2E_SHOTS || "e2e-shots";
fs.mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const screen = (name) => {
  try {
    execFileSync("import", ["-window", "root", `${shots}/${name}.png`]);
  } catch {}
};

const userData = path.join(home, ".config", "Cimes");
fs.mkdirSync(userData, { recursive: true });

// A Claude-format skill to import.
const src = path.join(home, "mon-skill-demo");
fs.mkdirSync(path.join(src, "references"), { recursive: true });
fs.writeFileSync(
  path.join(src, "SKILL.md"),
  "---\nname: mon-skill-demo\ndescription: Skill de démonstration : s'utilise pour tester l'import.\n---\n# Démo\nBonjour.\n",
);
fs.writeFileSync(path.join(src, "references", "a.md"), "A");

const launch = () =>
  spawn(
    exe,
    [
      "--no-sandbox",
      "--remote-debugging-port=9334",
      ...(process.env.APP_EXTRA_ARGS || "").split(" ").filter(Boolean),
    ],
    {
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, ".config"),
        ALBERT_API_KEY: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
// First run creates the default settings; then seed a fake key (no network
// needed, the onboarding only checks that a key is stored) and relaunch.
{
  const first = launch();
  first.stdout.on("data", () => {});
  first.stderr.on("data", () => {});
  const settingsFile = path.join(userData, "user-settings.json");
  for (let i = 0; i < 60 && !fs.existsSync(settingsFile); i++) await sleep(500);
  await sleep(5000);
  first.kill();
  await sleep(2500);
  const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
  settings.providerSettings = {
    "custom::albert": {
      apiKey: { value: "sk-fake", encryptionType: "plaintext" },
    },
  };
  settings.selectedModel = {
    provider: "custom::albert",
    name: process.env.CIMES_E2E_MODEL || "deepseek-v4-flash-0731",
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings));
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    fs.rmSync(path.join(userData, f), { force: true });
  }
}
const proc = launch();
proc.stdout.on("data", () => {});
proc.stderr.on("data", () => {});
let browser;
for (let i = 0; i < 60 && !browser; i++) {
  try {
    browser = await chromium.connectOverCDP("http://127.0.0.1:9334");
  } catch {
    await sleep(500);
  }
}
const pages = () => browser.contexts().flatMap((c) => c.pages());
let main;
for (let i = 0; i < 80 && !main; i++) {
  main = pages().find(
    (p) => !p.url().includes("cimes-splash") && !p.url().startsWith("devtools"),
  );
  if (!main) await sleep(500);
}
await sleep(6000);
log(
  "url:",
  main.url(),
  "| onboarding:",
  !!(await main.$("[data-testid=albert-onboarding]")),
);
const click = (sel) => main.locator(sel).click();
const goto = async (route) => {
  await main.evaluate(
    (r) => document.querySelector(`a[href="${r}"]`)?.click(),
    route,
  );
  await sleep(2000);
};

await goto("/projects");
await main.waitForSelector("[data-testid=projects-page]", { timeout: 20000 });
screen("p1-projects");
await click("[data-testid=new-project]");
await main.fill("[data-testid=project-name-input]", "Training session");
await click("[data-testid=project-template-dossier]");
screen("p2-dialog");
await click("[data-testid=create-project]");
await sleep(4000);
screen("p2b-after-create");
log(
  "body:",
  (await main.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400),
);
await main.waitForSelector("[data-testid=project-page]", { timeout: 30000 });
log("project page url:", main.url());

const root = path.join(home, "dyad-apps");
const dirs = fs.existsSync(root) ? fs.readdirSync(root) : [];
log("apps dir entries:", dirs.join(","));
const projectDir = path.join(root, dirs.find((d) => /training/i.test(d)) ?? "");
log(
  "marker file:",
  fs.existsSync(path.join(projectDir, ".cimes", "project.json")),
  "| Documentation folder:",
  fs.existsSync(path.join(projectDir, "Documentation")),
);

// A scanned note (image-only PDF, no text layer) and a batch input folder.
const fixtures = new URL("../../src/knowledge/fixtures/", import.meta.url)
  .pathname;
fs.copyFileSync(
  path.join(fixtures, "scanned-note.pdf"),
  path.join(projectDir, "Documentation", "scanned-note.pdf"),
);
const lot = path.join(projectDir, "Sources", "lot");
fs.mkdirSync(lot, { recursive: true });
fs.writeFileSync(
  path.join(lot, "a.txt"),
  "Compte rendu du 3 mars. Décision : acheter 12 tablettes. Responsable : Mme Durand.",
);
fs.writeFileSync(
  path.join(lot, "b.txt"),
  "Compte rendu du 10 mars. Décision : reporter la formation au 5 mai. Responsable : M. Martin.",
);
fs.writeFileSync(
  path.join(lot, "c.txt"),
  "Compte rendu du 17 mars. Décision : renouveler le contrat de maintenance. Responsable : Mme Durand.",
);

await click("[data-testid=project-tab-docs]");
await click("[data-testid=project-index-docs]");
await main.waitForSelector("[data-testid='project-doc-scanned-note.pdf']", {
  timeout: 30000,
});
let ocrRow = "";
for (let i = 0; i < 90; i++) {
  ocrRow = await main.textContent(
    "[data-testid='project-doc-scanned-note.pdf']",
  );
  if (/Prêt|Erreur/.test(ocrRow)) break;
  await sleep(1000);
}
log("scanned PDF row:", ocrRow.trim());
screen("f1-docs");

await click("[data-testid=project-tab-chats]");
await click("[data-testid=project-new-chat]");
await main.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
await sleep(2500);

const approve = async () => {
  const button = main
    .locator(
      'button:has-text("Allow once"), button:has-text("Autoriser"), button:has-text("Always allow")',
    )
    .first();
  if (await button.count().catch(() => 0))
    await button.click({ force: true }).catch(() => {});
};
const ask = async (prompt, done, seconds = 150) => {
  const editor = main.locator('[contenteditable="true"]').first();
  await editor.click();
  await main.keyboard.type(prompt, { delay: 4 });
  await main.keyboard.press("Enter");
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await sleep(3000);
    await approve();
    const body =
      (await main
        .locator("body")
        .innerText()
        .catch(() => "")) || "";
    if (done(body)) return true;
  }
  return false;
};
const results = {};

// 1. OCR through the project RAG: the code only exists in the scanned PDF.
results.ocr = await ask(
  "Dans la documentation du projet, quelle est la phrase qui parle d'un code secret ? Cite le fichier.",
  (body) => /ZEBRE-4471/.test(body) && /scanned-note/i.test(body),
);
log("OCR via RAG answered:", results.ocr);
screen("f2-ocr");

// 2. Official data (public directory of the administration).
results.official = await ask(
  "Utilise les sources officielles : donne le téléphone et l'adresse de la mairie de Nanterre.",
  (body) => /01 47 29 50 50/.test(body),
);
log("official data answered:", results.official);
screen("f3-official");

// 3. Batch processing, resumable output on disk.
results.batch = await ask(
  "Utilise l'outil batch_files : pour chaque fichier du dossier Sources/lot, extrais la décision prise et le responsable en une ligne. Mets les résultats dans le dossier Batch results/decisions.",
  () =>
    fs.existsSync(
      path.join(projectDir, "Batch results", "decisions", "summary.csv"),
    ),
  240,
);
const out = path.join(projectDir, "Batch results", "decisions");
const outFiles = fs.existsSync(out) ? fs.readdirSync(out) : [];
log("batch output:", outFiles.join(","));
if (outFiles.includes("a.txt.md")) {
  log(
    "batch a.txt.md:",
    fs
      .readFileSync(path.join(out, "a.txt.md"), "utf8")
      .replace(/\s+/g, " ")
      .slice(0, 200),
  );
}
screen("f4-batch");

// 4. Activity log written by the app.
const logFile = path.join(home, ".config", "Cimes", "logs", "activity.jsonl");
const logFileAlt = path.join(userData, "logs", "activity.jsonl");
const logPath = fs.existsSync(logFile) ? logFile : logFileAlt;
const events = fs.existsSync(logPath)
  ? fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l))
  : [];
const names = new Set(events.map((e) => `${e.kind}:${e.name ?? ""}`));
log(
  "activity events:",
  events.length,
  "| kinds:",
  [...names].slice(0, 12).join(" "),
);
log("secrets in log:", /sk-|Bearer /.test(fs.readFileSync(logPath, "utf8")));

await browser.close().catch(() => {});
proc.kill();
log("RESULTS", JSON.stringify(results));
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
