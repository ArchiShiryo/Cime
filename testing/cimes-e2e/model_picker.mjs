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
// Open the model picker from the chat input and list the Albert models.
const trigger = main.locator("button:has-text(\"Albert\")").first();
await trigger.click({ timeout: 20000 });
await sleep(1500);
screen("m1-picker");
let text = await main.locator("[role=menu], [role=dialog], [data-slot=popover-content]").first().innerText().catch(() => "");
if (!/GPT-OSS/.test(text)) text = await main.locator("body").innerText();
for (const name of ["GPT-OSS 120B", "Mistral Medium", "Mistral Small", "Ministral", "Qwen3 Coder", "DeepSeek V4 Flash"]) {
  log(name, "visible:", text.includes(name));
}
await browser.close().catch(() => {});
proc.kill();
process.exit(0);
