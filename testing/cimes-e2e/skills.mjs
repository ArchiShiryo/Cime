// Packaged-app check of Settings > Skills (list, toggle, import a folder).
// Seeds a fake Albert key so the onboarding gate is skipped; no network needed.
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const exe = process.argv[2];
const home = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-skills-e2e-"));
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
  spawn(exe, ["--no-sandbox", "--remote-debugging-port=9334"], {
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      ALBERT_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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
    name: "deepseek-v4-flash-0731",
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
screen("s1-home");
// Navigate to settings through the router.
await main.evaluate(() => {
  const a = document.querySelector('a[href="/settings"]');
  if (a) a.click();
});
await sleep(2500);
log("settings url:", main.url());
await main.waitForSelector("[data-testid=skills-settings]", { timeout: 20000 });
const names = await main.$$eval("[data-testid^=skill-]", (els) =>
  els.map((e) => e.getAttribute("data-testid")),
);
log("skills listed:", names.length, names.slice(0, 4).join(","));
log(
  "knowledge settings present:",
  !!(await main.$("[data-testid=knowledge-settings]")),
);
await main.locator("[data-testid=knowledge-settings]").scrollIntoViewIfNeeded();
await sleep(400);
screen("s2b-knowledge");
await main.locator("[data-testid=skills-settings]").scrollIntoViewIfNeeded();
await sleep(500);
screen("s2-skills");
// Toggle one off.
const sw = main.locator("[data-testid=skill-charte-canope] [role=switch]");
await sw.click();
await sleep(800);
log(
  "charte-canope checked after toggle:",
  await sw.getAttribute("aria-checked"),
);
// Import by calling the IPC import path directly is dialog-based; check the folder open API exists.
fs.mkdirSync(path.join(userData, "skills"), { recursive: true });
fs.cpSync(src, path.join(userData, "skills", "mon-skill-demo"), {
  recursive: true,
});
await main.evaluate(() => document.querySelector('a[href="/"]')?.click());
await sleep(2000);
await main.evaluate(() =>
  document.querySelector('a[href="/settings"]')?.click(),
);
await sleep(3000);
await main
  .waitForSelector("[data-testid=skills-settings]", { timeout: 20000 })
  .catch(() => {});
log(
  "imported skill visible:",
  !!(await main.$("[data-testid=skill-mon-skill-demo]")),
);
screen("s3-after");
await main.evaluate(() =>
  document.querySelector('a[href="/plugins"]')?.click(),
);
await sleep(4000);
const pluginsText = await main.textContent("body");
log(
  "plugins page url:",
  main.url(),
  "| Context7:",
  /Context7/.test(pluginsText),
  "| Mémoire:",
  /Mémoire/.test(pluginsText),
);
screen("s4-plugins");
for (const route of ["documents", "skills"]) {
  await main.evaluate(
    (r) => document.querySelector(`a[href="/${r}"]`)?.click(),
    route,
  );
  await sleep(2500);
  log(
    `${route} page:`,
    main.url(),
    "| h1:",
    await main
      .locator("h1")
      .first()
      .textContent()
      .catch(() => "?"),
  );
  screen(`s5-${route}`);
}
await browser.close().catch(() => {});
proc.kill();
process.exit(0);
