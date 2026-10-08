// Packaged-app check of Projets: create from a template, project docs, index, scoped skills, agent turn.
// Seeds a fake Albert key; the agent turn uses the CIMES_E2E_* endpoint override (e.g. DeepSeek).
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

// Reference document with a phrase only the project doc contains.
fs.writeFileSync(
  path.join(projectDir, "Documentation", "referentiel.md"),
  "# Référentiel\n\nIndicateur 23 : le code secret de la salle des preuves est ZEBRE-4471.\n",
);
await click("[data-testid=project-tab-docs]");
await click("[data-testid=project-index-docs]");
await main.waitForSelector("[data-testid='project-doc-referentiel.md']", {
  timeout: 30000,
});
for (let i = 0; i < 60; i++) {
  const t = await main.textContent(
    "[data-testid='project-doc-referentiel.md']",
  );
  if (/Prêt/.test(t)) break;
  await sleep(1000);
}
log(
  "doc row:",
  (await main.textContent("[data-testid='project-doc-referentiel.md']")).trim(),
);
screen("p3-docs");

await click("[data-testid=project-tab-skills]");
await main.waitForSelector("[data-testid=project-skills]");
const checked = await main.$$eval(
  "[data-testid^=project-skill-]:checked",
  (els) => els.map((e) => e.getAttribute("data-testid").slice(14)),
);
log("enabled skills:", checked.join(","));
screen("p4-skills");

await click("[data-testid=project-tab-chats]");
await click("[data-testid=project-new-chat]");
await main.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
await sleep(2500);
log(
  "chat url:",
  main.url(),
  "| preview panel text:",
  /Preview|Aperçu/.test(await main.textContent("body")),
);
screen("p5-chat");
const editor = main.locator('[contenteditable="true"]').first();
await editor.click();
await main.keyboard.type(
  process.env.AGENT_PROMPT ||
    "Quel est le code secret de la salle des preuves ? Cherche dans la documentation du projet.",
  { delay: 5 },
);
await main.keyboard.press("Enter");
const deadline = Date.now() + Number(process.env.AGENT_TIMEOUT_S || 240) * 1000;
let body = "";
let found = false;
while (Date.now() < deadline) {
  await sleep(3000);
  const approve = main
    .locator('button:has-text("Allow once"), button:has-text("Autoriser")')
    .first();
  if (await approve.count().catch(() => 0))
    await approve.click().catch(() => {});
  body =
    (await main
      .locator("body")
      .innerText()
      .catch(() => "")) || "";
  if ((body.match(/ZEBRE-4471/g) ?? []).length >= 1) {
    found = true;
    break;
  }
}
log("answer contains the secret from the project doc:", found);
screen("p6-answer");
await browser.close().catch(() => {});
proc.kill();
process.exit(found ? 0 : 1);
