// Packaged-app check: writing preferences, memory, project rename/move/delete, OpenDocument in the RAG, PDF export.
// Needs the CIMES_E2E_* endpoint override (e.g. DeepSeek).
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

import { strToU8, zipSync } from "fflate";

const results = {};
const approve = async () => {
  const button = main
    .locator(
      'button:has-text("Allow once"), button:has-text("Autoriser une fois"), button:has-text("Autoriser"), button:has-text("Allow")',
    )
    .first();
  if (await button.count().catch(() => 0))
    await button.click({ force: true }).catch(() => {});
};
const bodyText = async () =>
  (await main
    .locator("body")
    .innerText()
    .catch(() => "")) || "";
const ask = async (prompt, done, seconds = 150) => {
  const editor = main.locator('[contenteditable="true"]').first();
  await editor.click();
  await main.keyboard.type(prompt, { delay: 4 });
  await main.keyboard.press("Enter");
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await sleep(3000);
    await approve();
    if (await done(await bodyText())) return true;
  }
  return false;
};
const openProject = async (name) => {
  await goto("/projects");
  await main.locator(`[data-testid="project-${name}"]`).click();
  await main.waitForSelector("[data-testid=project-page]", { timeout: 20000 });
};

// ---- second project -----------------------------------------------------------
await goto("/projects");
await click("[data-testid=new-project]");
await main.fill("[data-testid=project-name-input]", "Autre projet");
await click("[data-testid=create-project]");
await main.waitForSelector("[data-testid=project-page]", { timeout: 30000 });
const otherDir = path.join(
  root,
  fs.readdirSync(root).find((d) => /autre/i.test(d)) ?? "",
);
log(
  "second project folder:",
  fs.existsSync(path.join(otherDir, ".cimes", "project.json")),
);

// ---- writing preferences (Settings > Personalization) -----------------------
await goto("/settings");
await main.waitForSelector("[data-testid=personalization-settings]", {
  timeout: 20000,
});
await click("[data-testid=pref-addressForm-informal]");
await main.fill("#pref-signature", "Marie Durand\nDirection de la formation");
await main.locator("#pref-service").click();
await sleep(1200);
const settingsFile = path.join(userData, "user-settings.json");
const stored =
  JSON.parse(fs.readFileSync(settingsFile, "utf8")).writingPreferences ?? {};
log("preferences stored:", JSON.stringify(stored));
results.prefsStored =
  stored.addressForm === "informal" &&
  /Marie Durand/.test(stored.signature ?? "");

// ---- memory + preferences through the agent ---------------------------------
await openProject("Training session");
await click("[data-testid=project-new-chat]");
await main.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
await sleep(2500);
results.signature = await ask(
  "Rédige un très court message d'invitation à la réunion d'équipe de jeudi 14 h.",
  async (b) => /Marie Durand/.test(b),
  120,
);
log("signature from preferences used:", results.signature);
screen("g1-signature");

results.memorySaved = await ask(
  "Retiens que je préfère des notes de synthèse d'une page maximum. Utilise ta mémoire personnelle.",
  async () =>
    fs.existsSync(path.join(userData, "memory")) &&
    fs
      .readdirSync(path.join(userData, "memory"))
      .some((f) => f.endsWith(".md")),
  150,
);
log(
  "memory file written:",
  results.memorySaved,
  fs.existsSync(path.join(userData, "memory"))
    ? fs.readdirSync(path.join(userData, "memory")).join(",")
    : "",
);
screen("g2-memory");

// A new conversation must know it without being told again.
await openProject("Training session");
await click("[data-testid=project-new-chat]");
await main.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
await sleep(2500);
results.memoryRecalled = await ask(
  "Quel format de notes de synthèse est-ce que je préfère ? Réponds en une phrase.",
  async (b) =>
    /une page|1 page|one page/i.test(b.split("Quel format de notes")[1] ?? ""),
  120,
);
log("memory recalled in a new conversation:", results.memoryRecalled);
screen("g3-recall");

// ---- OpenDocument in the RAG, and a PDF export -------------------------------
const odt = zipSync({
  mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
  "content.xml": strToU8(
    '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:h text:outline-level="1">Règlement intérieur</text:h><text:p>Le code du cadenas de la salle LibreOffice est PINGOUIN-3392.</text:p></office:text></office:body></office:document-content>',
  ),
});
fs.writeFileSync(path.join(projectDir, "Documentation", "reglement.odt"), odt);
await openProject("Training session");
await click("[data-testid=project-tab-docs]");
await click("[data-testid=project-index-docs]");
await main.waitForSelector("[data-testid='project-doc-reglement.odt']", {
  timeout: 30000,
});
let odtRow = "";
for (let i = 0; i < 60; i++) {
  odtRow = await main.textContent("[data-testid='project-doc-reglement.odt']");
  if (/Prêt|Erreur/.test(odtRow)) break;
  await sleep(1000);
}
log("odt row:", odtRow.trim());
results.odtIndexed = /Prêt/.test(odtRow);

await click("[data-testid=project-tab-chats]");
await click("[data-testid=project-new-chat]");
await main.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
await sleep(2500);
results.pdf = await ask(
  "Crée un PDF nommé note-cadenas.pdf dans le dossier Livrables avec un titre « Note interne » et une phrase disant que le code du cadenas est dans le règlement intérieur. Utilise le toolkit Office (md2pdf).",
  async () =>
    fs.existsSync(path.join(projectDir, "Livrables", "note-cadenas.pdf")) ||
    fs.existsSync(path.join(projectDir, "Deliverables", "note-cadenas.pdf")),
  200,
);
log("pdf created:", results.pdf);
screen("g4-pdf");

// ---- move a conversation, rename, delete -------------------------------------
await openProject("Training session");
await click("[data-testid=project-tab-chats]");
const moveButtons = main.locator('[data-testid^="move-chat-"]');
const before = await moveButtons.count();
await moveButtons.first().click();
await main.locator('[data-testid="move-to-Autre projet"]').click();
await sleep(2500);
const after = await main.locator('[data-testid^="move-chat-"]').count();
log("chats before/after move:", before, after);
results.moved = after === before - 1;
await openProject("Autre projet");
await click("[data-testid=project-tab-chats]");
results.arrived =
  (await main.locator('[data-testid^="move-chat-"]').count()) >= 1;
log("conversation arrived in the other project:", results.arrived);
screen("g5-moved");

await click("[data-testid=project-rename]");
await main.fill("[data-testid=project-rename-input]", "Projet renommé");
await click("[data-testid=project-rename-confirm]");
await sleep(2500);
results.renamed = /Projet renommé/.test(
  await main.locator("h1").first().textContent(),
);
log("renamed:", results.renamed, "| folder kept:", fs.existsSync(otherDir));

await click("[data-testid=project-delete]");
const confirm = main.locator("[data-testid=project-delete-confirm]");
results.deleteNeedsTick = await confirm.isDisabled();
await click("[data-testid=project-delete-understood]");
await confirm.click();
await main.waitForSelector("[data-testid=projects-page]", { timeout: 20000 });
await sleep(1500);
results.deleted =
  !fs.existsSync(otherDir) &&
  !(await main.$('[data-testid="project-Projet renommé"]'));
log("deleted (folder gone, not listed):", results.deleted);
screen("g6-after-delete");

await browser.close().catch(() => {});
proc.kill();
log("RESULTS", JSON.stringify(results));
process.exit(Object.values(results).every(Boolean) ? 0 : 1);
