// Audits the interface language in the packaged app: visits the main screens and lists the visible texts that still look English.
// Usage: E2E_LANG=fr|en node testing/cimes-e2e/i18n_audit.mjs out/Cimes-linux-x64/Cimes
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
  if (process.env.E2E_LANG) settings.language = process.env.E2E_LANG;
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

// ---- audit -------------------------------------------------------------------
const EN = new Set(
  "the to your and you for with this that is are or from will can not in of on be it as an at by if when have has more all any new use used about into after before without only".split(
    " ",
  ),
);
const FR = new Set(
  "le la les des du de et un une pour vous votre vos dans est sur avec ce cette qui que ne pas par au aux ou en se son sa ses nous mes est sont être aucun aucune plus tout tous".split(
    " ",
  ),
);
const looksEnglish = (text) => {
  const words = text.toLowerCase().match(/[a-zàâçéèêëîïôûùü']+/g) ?? [];
  if (words.length === 0) return false;
  const en = words.filter((w) => EN.has(w)).length;
  const fr = words.filter((w) => FR.has(w)).length;
  if (en > fr && en >= 1) return true;
  // short UI labels: a single capitalised English-looking word is checked against a small list
  return (
    words.length <= 3 &&
    /^(back|next|submit|cancel|save|close|delete|settings|preview|code|publish|undo|retry|thought|search|apps|chat|loading|error|help|import|export|create|open|select|add|remove|edit|new|done|continue|skip|approve|configure|connect|disconnect|enable|disable|upgrade|learn more|get started|sign in|log in|sign out)$/i.test(
      text.trim(),
    )
  );
};
const collect = () =>
  main.evaluate(() => {
    const out = new Set();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) {
        const el = n.parentElement;
        if (!el || /^(SCRIPT|STYLE|CODE|PRE|NOSCRIPT)$/.test(el.tagName))
          continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const t = n.nodeValue.replace(/\s+/g, " ").trim();
        if (t) out.add(t);
      } else {
        for (const a of ["placeholder", "title", "aria-label"]) {
          const v = n.getAttribute?.(a);
          if (v) out.add(v.replace(/\s+/g, " ").trim());
        }
      }
    }
    return [...out];
  });

const report = {};
const visit = async (name, route) => {
  if (route) await goto(route);
  await sleep(2500);
  const texts = await collect();
  report[name] = { total: texts.length, english: texts.filter(looksEnglish) };
  screen(`i18n-${name}`);
  log(
    `${name}: ${texts.length} texts, ${report[name].english.length} look English`,
  );
};

await visit("home", "/");
await visit("settings", "/settings");
await main.evaluate(() => window.scrollTo(0, 0));
// the settings page is one long page: scroll through it so every section renders
for (let y = 0; y < 8; y++) {
  await main.evaluate(
    (i) =>
      document.querySelector("main, #root")?.scrollBy?.(0, 900) ??
      window.scrollBy(0, 900),
    y,
  );
  await sleep(300);
}
report.settings.english = [
  ...new Set([
    ...report.settings.english,
    ...(await collect()).filter(looksEnglish),
  ]),
];
await visit("library", "/library");
await visit("templates", "/templates");
await visit("documents", "/documents");
await visit("skills", "/skills");
await visit("plugins", "/plugins");
await visit("projects", "/projects");
await click("[data-testid=project-new-chat]").catch(() => {});
await main.evaluate(() =>
  document.querySelector('a[href="/projects"]')?.click(),
);
await sleep(1500);
await main.evaluate(() =>
  document.querySelector('[data-testid^="project-"]')?.click(),
);
await sleep(2500);
await click("[data-testid=project-new-chat]").catch(() => {});
await sleep(3000);
await visit("chat", null);

const out = process.env.AUDIT_OUT || "/tmp/i18n-audit.json";
fs.writeFileSync(out, JSON.stringify(report, null, 2));
const all = [...new Set(Object.values(report).flatMap((r) => r.english))];
log("DISTINCT ENGLISH-LOOKING TEXTS:", all.length);
for (const t of all.slice(0, 60)) log(" -", t.slice(0, 120));
await browser.close().catch(() => {});
proc.kill();
process.exit(0);
