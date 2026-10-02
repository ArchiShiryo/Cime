import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const exe = process.argv[2];
const key = process.env.ALBERT_KEY_FOR_TEST;
const prompt = process.env.AGENT_PROMPT;
const home =
  process.env.E2E_HOME ||
  fs.mkdtempSync(path.join(os.tmpdir(), "cimes-agent-"));
const shots = process.env.E2E_SHOTS || "agent-shots";
fs.mkdirSync(shots, { recursive: true });
const t0 = Date.now();
const log = (...a) =>
  console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const screen = (name) => {
  try {
    execFileSync("import", ["-window", "root", `${shots}/${name}.png`]);
  } catch {}
};
const userData = path.join(home, ".config", "Cimes");

function launch() {
  const proc = spawn(
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
  proc.stdout.on("data", (d) => {
    const s = d.toString();
    if (/web_|run_shell|local_web|shell|agent|untrusted|Error|error/i.test(s))
      process.stdout.write(
        "[app] " + s.slice(0, 260).replace(/\n+$/, "") + "\n",
      );
  });
  proc.stderr.on("data", () => {});
  return proc;
}
async function connect() {
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9334");
    } catch {
      await sleep(500);
    }
  }
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    page = browser
      .contexts()
      .flatMap((c) => c.pages())
      .find(
        (p) =>
          !p.url().includes("cimes-splash") && !p.url().startsWith("devtools"),
      );
    if (!page) await sleep(500);
  }
  return { browser, page };
}

// 1) first launch: connect Albert, then close, then pre-seed settings (no blueprint step)
let proc = launch();
let { browser, page } = await connect();
if (
  await page
    .waitForSelector("[data-testid=albert-onboarding]", { timeout: 20000 })
    .catch(() => null)
) {
  await page.fill("#albert-api-key", key);
  await page.click("[data-testid=albert-connect-button]");
  await page.waitForSelector("[data-testid=albert-onboarding]", {
    state: "detached",
    timeout: 40000,
  });
  log("Albert connected");
}
await sleep(1500);
await browser.close().catch(() => {});
proc.kill();
await sleep(2500);
const settingsPath = path.join(userData, "user-settings.json");
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
settings.enableAppBlueprint = false;
settings.selectedChatMode = "local-agent";
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
if (process.env.MCP_SEED_JSON) {
  // Optional: register a stdio MCP server straight in the app database.
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(path.join(userData, "sqlite.db"));
  const seed = JSON.parse(process.env.MCP_SEED_JSON);
  const env = {};
  for (const k of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NODE_EXTRA_CA_CERTS", "npm_config_https_proxy", "npm_config_cafile", "SSL_CERT_FILE", "PATH"]) {
    if (process.env[k]) env[k] = process.env[k];
  }
  db.prepare(
    "INSERT INTO mcp_servers (name, transport, command, args, env_json, enabled) VALUES (?, ?, ?, ?, ?, 1)",
  ).run(seed.name, "stdio", seed.command, JSON.stringify(seed.args), JSON.stringify(env));
  db.close();
  log("MCP server seeded:", seed.name);
}
log("settings seeded; selectedModel =", JSON.stringify(settings.selectedModel));

// 2) second launch: send the prompt
proc = launch();
({ browser, page } = await connect());
await page.waitForSelector(
  '[data-testid=chat-input-container], [contenteditable="true"]',
  { timeout: 60000 },
);
await sleep(2500);
screen("1-home");
const editor = page.locator('[contenteditable="true"]').first();
await editor.click();
await page.keyboard.type(prompt, { delay: 5 });
await sleep(500);
await page.keyboard.press("Enter");
log("prompt sent");

const seen = new Set();
const mark = (k, msg) => {
  if (!seen.has(k)) {
    seen.add(k);
    log(msg);
  }
};
let approvedShell = 0;
const deadline = Date.now() + Number(process.env.AGENT_TIMEOUT_S || 300) * 1000;
let lastText = "";
while (Date.now() < deadline) {
  await sleep(2000);
  const html = await page.content().catch(() => "");
  if (/dyad-web-search|Search the web|web_search/i.test(html))
    mark("search", "UI: web search card seen");
  if (/dyad-web-fetch|Fetch URL|web_fetch/i.test(html))
    mark("fetch", "UI: web fetch card seen");
  if (/Shell: |run_shell|PowerShell|Bash:/i.test(html))
    mark("shell", "UI: shell card seen");
  // approve any consent dialog (shell approval etc.)
  const approve = page
    .locator(
      'button:has-text("Allow once"), button:has-text("Approve"), button:has-text("Autoriser"), button:has-text("Always allow")',
    )
    .first();
  if (await approve.count().catch(() => 0)) {
    const label =
      (await approve
        .first()
        .textContent()
        .catch(() => "")) || "";
    const dialogText = (
      (await page
        .locator("[role=dialog], [role=alertdialog]")
        .first()
        .textContent()
        .catch(() => "")) || ""
    )
      .replace(/\s+/g, " ")
      .slice(0, 320);
    log("CONSENT DIALOG:", dialogText);
    screen(`consent-${++approvedShell}`);
    await approve
      .first()
      .click({ force: true })
      .catch(() => {});
    log("approved with", label.trim());
  }
  const bodyText =
    (await page
      .locator("body")
      .innerText()
      .catch(() => "")) || "";
  if (bodyText !== lastText) {
    lastText = bodyText;
  }
  // finished when no streaming indicator and the retry/undo buttons are present after the answer
  const done =
    (await page
      .locator('button:has-text("Retry")')
      .count()
      .catch(() => 0)) > 0 &&
    !(await page
      .locator('[aria-label*="Cancel generation"], button:has-text("Stop")')
      .count()
      .catch(() => 0));
  if (done && Date.now() - t0 > 20000) {
    await sleep(3000);
    break;
  }
}
screen("2-final");
const finalText = (
  (await page
    .locator("body")
    .innerText()
    .catch(() => "")) || ""
).replace(/\n{2,}/g, "\n");
fs.writeFileSync(`${shots}/final-text.txt`, finalText);
log("FINAL TEXT (first 2500 chars):\n" + finalText.slice(0, 2500));
await browser.close().catch(() => {});
proc.kill();
await sleep(1500);
log("done; home =", home);
