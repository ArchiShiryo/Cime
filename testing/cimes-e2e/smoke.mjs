import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const exe = process.argv[2];
const key = process.env.ALBERT_KEY_FOR_TEST;
const home =
  process.env.E2E_HOME || fs.mkdtempSync(path.join(os.tmpdir(), "cimes-e2e-"));
const shots = process.env.E2E_SHOTS || "e2e-shots";
fs.mkdirSync(shots, { recursive: true });
const t0 = Date.now();
const log = (...a) =>
  console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s`, ...a);
const screen = (name) => {
  try {
    execFileSync("import", ["-window", "root", `${shots}/${name}.png`]);
    log("screen", name);
  } catch (e) {
    log("screen err", e.message);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(exe, ["--no-sandbox", "--remote-debugging-port=9333"], {
  env: {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, ".config"),
    ALBERT_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
proc.stdout.on("data", (d) => {
  const s = d.toString();
  if (/splash|albert|Albert|error/i.test(s))
    process.stdout.write("[app] " + s.slice(0, 300));
});
proc.stderr.on("data", () => {});

// Splash phase: capture the screen early.
await sleep(1500);
screen("1-t1.5s");
await sleep(1500);
screen("2-t3s");

let browser;
for (let i = 0; i < 40 && !browser; i++) {
  try {
    browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  } catch {
    await sleep(500);
  }
}
if (!browser) {
  log("could not connect");
  proc.kill();
  process.exit(1);
}
const pages = () => browser.contexts().flatMap((c) => c.pages());
let main;
for (let i = 0; i < 60 && !main; i++) {
  main = pages().find(
    (p) => !p.url().includes("cimes-splash") && !p.url().startsWith("devtools"),
  );
  if (!main) await sleep(500);
}
log(
  "pages:",
  pages()
    .map((p) => p.url().slice(0, 70))
    .join(" | "),
);
if (process.env.E2E_PHASE === "restart") {
  await sleep(7000);
  const ob = await main.$("[data-testid=albert-onboarding]");
  log("after restart, onboarding shown again:", !!ob);
  screen("9-after-restart");
  const body = await main.textContent("body");
  log(
    "restart: DeepSeek visible:",
    /DeepSeek/.test(body),
    "| theme class:",
    await main.evaluate(() => document.documentElement.className),
  );
  await browser.close().catch(() => {});
  proc.kill();
  process.exit(0);
}
await main.waitForSelector("[data-testid=albert-onboarding]", {
  timeout: 60000,
});
log("onboarding in DOM");
await sleep(3500);
screen("3-onboarding");
await main.fill("#albert-api-key", "sk-mauvaise-cle");
await main.click("[data-testid=albert-connect-button]");
await main.waitForSelector("[data-testid=albert-error]", { timeout: 30000 });
log(
  "bad key error:",
  (await main.textContent("[data-testid=albert-error]")).replace(/\s+/g, " "),
);
screen("4-bad-key");
if (key) {
  await main.fill("#albert-api-key", key);
  await main.click("[data-testid=albert-connect-button]");
  await main.waitForSelector("[data-testid=albert-onboarding]", {
    state: "detached",
    timeout: 30000,
  });
  log("connected, onboarding gone");
  await sleep(2000);
  screen("5-home");
  const body = await main.textContent("body");
  const proCount = (body.match(/\bPro\b/g) || []).length;
  log(
    "Upgrade:",
    /Upgrade/.test(body),
    '| "Pro" words:',
    proCount,
    "| DeepSeek:",
    /DeepSeek/.test(body),
    "| Basic Agent:",
    /Basic Agent/.test(body),
    "| Dyad mentions:",
    (body.match(/Dyad/g) || []).length,
  );
  log(
    "theme class:",
    await main.evaluate(() => document.documentElement.className),
  );
  const toggle = main
    .locator("button", { hasText: /^(Sombre|Clair)$/ })
    .first();
  const n = await toggle.count();
  log("toggle buttons found:", n);
  if (n) {
    await toggle.click({ force: true });
    await sleep(800);
    log(
      "theme class after toggle:",
      await main.evaluate(() => document.documentElement.className),
    );
    screen("6-dark");
    await toggle.click({ force: true });
    await sleep(500);
  }
}
await browser.close().catch(() => {});
proc.kill();
await sleep(1500);
log("done; home=", home);
