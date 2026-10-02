#!/usr/bin/env node
// cimes-control: an MCP server that lets Codex, Claude Code or any MCP client
// drive a running Cimes (Electron) app for debugging, QA and day-to-day work.
// It talks to the app through the Chrome DevTools Protocol (the app is started
// with --remote-debugging-port) and can read the app's own logs.
//
//   node tools/cimes-control/server.mjs          (stdio transport)
//
// SECURITY: the debugging port gives full control of the app to any local
// program. Use this on your own machine only, never on a shared PC.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const shotsDir =
  process.env.CIMES_CONTROL_SHOTS ||
  path.join(os.tmpdir(), "cimes-control-shots");
fs.mkdirSync(shotsDir, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  child: null,
  browser: null,
  port: 9333,
  userDataDir: null,
};

function defaultUserDataDir() {
  if (process.platform === "win32")
    return path.join(process.env.APPDATA ?? os.homedir(), "Cimes");
  if (process.platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support", "Cimes");
  return path.join(
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"),
    "Cimes",
  );
}

async function mainPage() {
  if (!state.browser)
    throw new Error("Not connected. Call cimes_launch or cimes_attach first.");
  const pages = state.browser.contexts().flatMap((context) => context.pages());
  const page = pages.find(
    (candidate) =>
      !candidate.url().includes("cimes-splash") &&
      !candidate.url().startsWith("devtools"),
  );
  if (!page)
    throw new Error(
      "The Cimes window is not ready yet (splash still showing?). Retry in a few seconds.",
    );
  return page;
}

async function connect(port, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      state.browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      state.port = port;
      break;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  if (!state.browser)
    throw new Error(`Could not connect to port ${port}: ${lastError?.message}`);
  while (Date.now() < deadline) {
    try {
      return await mainPage();
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Connected, but the main window never appeared.");
}

const text = (value) => ({
  content: [
    {
      type: "text",
      text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
    },
  ],
});

async function screenshot(name) {
  const page = await mainPage();
  const file = path.join(shotsDir, `${name || "shot"}-${Date.now()}.png`);
  const buffer = await page.screenshot({ path: file });
  return {
    content: [
      { type: "text", text: `Screenshot saved: ${file}` },
      { type: "image", data: buffer.toString("base64"), mimeType: "image/png" },
    ],
  };
}

const CONSENT_BUTTONS =
  'button:has-text("Allow once"), button:has-text("Approve"), button:has-text("Autoriser"), button:has-text("Always allow")';

async function consentDialog(page) {
  const buttons = page.locator(CONSENT_BUTTONS);
  if (!(await buttons.count().catch(() => 0))) return null;
  const dialog = page.locator("[role=dialog], [role=alertdialog]").first();
  return {
    text: ((await dialog.innerText().catch(() => "")) || "")
      .replace(/\s+/g, " ")
      .slice(0, 600),
    buttons: await buttons.allInnerTexts().catch(() => []),
  };
}

async function sendPrompt({
  prompt,
  wait_seconds = 180,
  auto_approve = false,
}) {
  const page = await mainPage();
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.type(prompt, { delay: 4 });
  await sleep(300);
  await page.keyboard.press("Enter");
  const started = Date.now();
  const approvals = [];
  let status = "timeout";
  while (Date.now() - started < wait_seconds * 1000) {
    await sleep(2000);
    const consent = await consentDialog(page);
    if (consent) {
      if (auto_approve) {
        approvals.push(consent.text);
        await page
          .locator(CONSENT_BUTTONS)
          .first()
          .click({ force: true })
          .catch(() => {});
        continue;
      }
      status = "waiting_for_consent";
      return text({
        status,
        consent,
        hint: "Use cimes_click with the button text to answer, then cimes_read_chat.",
      });
    }
    const retry = await page
      .locator('button:has-text("Retry")')
      .count()
      .catch(() => 0);
    const stop = await page
      .locator('[aria-label*="Cancel generation"], button:has-text("Stop")')
      .count()
      .catch(() => 0);
    if (retry > 0 && stop === 0 && Date.now() - started > 8000) {
      status = "done";
      break;
    }
  }
  await sleep(1500);
  return text({
    status,
    approved_consents: approvals,
    chat: await chatText(page),
  });
}

async function chatText(page) {
  const body = (
    (await page
      .locator("body")
      .innerText()
      .catch(() => "")) || ""
  ).replace(/\n{3,}/g, "\n\n");
  return body.length > 12000 ? `${body.slice(0, 12000)}\n…(truncated)` : body;
}

function readLogs({ lines = 80, filter, userDataDir }) {
  const dir = userDataDir || state.userDataDir || defaultUserDataDir();
  const candidates = [
    path.join(dir, "logs", "main.log"),
    path.join(repoRoot, "userData", "logs", "main.log"),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return `No main.log found (looked in: ${candidates.join(", ")})`;
  let rows = fs.readFileSync(file, "utf8").split("\n");
  if (filter) {
    const pattern = new RegExp(filter, "i");
    rows = rows.filter((row) => pattern.test(row));
  }
  return `${file}\n${rows.slice(-lines).join("\n")}`;
}

const tools = [
  {
    name: "cimes_launch",
    description:
      "Start Cimes with a DevTools port and connect to it. Give the path of the executable (Cimes.exe or the dev Electron command is not supported here: for dev run `npm start -- --remote-debugging-port=9333` yourself and use cimes_attach). Use a throw-away user_data_dir for clean tests.",
    inputSchema: {
      type: "object",
      properties: {
        executable: {
          type: "string",
          description: "Path to Cimes.exe / Cimes binary",
        },
        port: { type: "number", description: "DevTools port (default 9333)" },
        user_data_dir: {
          type: "string",
          description: "Isolated profile folder (recommended)",
        },
        env: {
          type: "object",
          additionalProperties: { type: "string" },
          description: "Extra environment variables",
        },
        extra_args: { type: "array", items: { type: "string" } },
      },
      required: ["executable"],
    },
  },
  {
    name: "cimes_attach",
    description:
      "Connect to a Cimes already running with --remote-debugging-port.",
    inputSchema: {
      type: "object",
      properties: {
        port: { type: "number" },
        user_data_dir: { type: "string" },
      },
    },
  },
  {
    name: "cimes_status",
    description:
      "Current page URL, title and whether the onboarding or a consent dialog is showing.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cimes_screenshot",
    description:
      "Screenshot of the Cimes window (returned as an image and saved to disk).",
    inputSchema: { type: "object", properties: { name: { type: "string" } } },
  },
  {
    name: "cimes_navigate",
    description:
      "Open a page from the side menu: / (apps), /settings, /library, /templates, /documents, /skills, /plugins.",
    inputSchema: {
      type: "object",
      properties: { route: { type: "string" } },
      required: ["route"],
    },
  },
  {
    name: "cimes_text",
    description: "Visible text of the current page (truncated).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cimes_click",
    description:
      "Click an element by CSS selector or by visible text (text=…).",
    inputSchema: {
      type: "object",
      properties: { selector: { type: "string" } },
      required: ["selector"],
    },
  },
  {
    name: "cimes_type",
    description:
      "Fill an input by selector (use #albert-api-key for the Albert key field).",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string" },
        text: { type: "string" },
        press_enter: { type: "boolean" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "cimes_connect_albert",
    description:
      "Complete the first-launch Albert onboarding with an API key. The key is typed into the app and never logged by this server.",
    inputSchema: {
      type: "object",
      properties: { api_key: { type: "string" } },
      required: ["api_key"],
    },
  },
  {
    name: "cimes_send_prompt",
    description:
      "Type a message in the chat box, send it and wait for the agent to finish. Returns the page text. If a consent dialog (shell, MCP…) appears and auto_approve is false, returns status waiting_for_consent with the dialog text.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        wait_seconds: { type: "number" },
        auto_approve: {
          type: "boolean",
          description:
            "Click Allow on consent dialogs. Dangerous: only for disposable profiles.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "cimes_read_chat",
    description: "Text of the current chat page.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cimes_read_logs",
    description:
      "Tail of Cimes' own logs/main.log (model requests, tool calls, errors). Optional regex filter.",
    inputSchema: {
      type: "object",
      properties: {
        lines: { type: "number" },
        filter: { type: "string" },
        user_data_dir: { type: "string" },
      },
    },
  },
  {
    name: "cimes_eval",
    description:
      "Run a JavaScript expression in the app's renderer and return the JSON result (debugging only).",
    inputSchema: {
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
    },
  },
  {
    name: "cimes_close",
    description: "Disconnect and stop the app if this server launched it.",
    inputSchema: { type: "object", properties: {} },
  },
];

const handlers = {
  async cimes_launch({
    executable,
    port = 9333,
    user_data_dir,
    env = {},
    extra_args = [],
  }) {
    if (state.child)
      throw new Error("Already launched. Call cimes_close first.");
    const args = [`--remote-debugging-port=${port}`, ...extra_args];
    if (process.platform === "linux" && process.getuid?.() === 0)
      args.push("--no-sandbox");
    if (user_data_dir) {
      fs.mkdirSync(user_data_dir, { recursive: true });
      args.push(`--user-data-dir=${user_data_dir}`);
      state.userDataDir = user_data_dir;
    }
    state.child = spawn(executable, args, {
      env: { ...process.env, ...env },
      stdio: "ignore",
      detached: false,
    });
    state.child.on("exit", () => {
      state.child = null;
      state.browser = null;
    });
    const page = await connect(port);
    return text({
      launched: true,
      pid: state.child?.pid,
      url: page.url(),
      user_data_dir: state.userDataDir,
    });
  },
  async cimes_attach({ port = 9333, user_data_dir }) {
    if (user_data_dir) state.userDataDir = user_data_dir;
    const page = await connect(port, 20_000);
    return text({ attached: true, url: page.url() });
  },
  async cimes_status() {
    const page = await mainPage();
    return text({
      url: page.url(),
      title: await page.title(),
      onboarding_visible: Boolean(
        await page.$("[data-testid=albert-onboarding]"),
      ),
      consent_dialog: await consentDialog(page),
      launched_by_server: Boolean(state.child),
      user_data_dir: state.userDataDir ?? defaultUserDataDir(),
    });
  },
  cimes_screenshot: ({ name }) => screenshot(name),
  async cimes_navigate({ route }) {
    const page = await mainPage();
    const clicked = await page.evaluate((target) => {
      const link = document.querySelector(`a[href="${target}"]`);
      link?.click();
      return Boolean(link);
    }, route);
    await sleep(1500);
    return text({ navigated: clicked, url: page.url() });
  },
  async cimes_text() {
    return text(await chatText(await mainPage()));
  },
  async cimes_click({ selector }) {
    const page = await mainPage();
    await page.locator(selector).first().click({ timeout: 15_000 });
    await sleep(800);
    return text({ clicked: selector });
  },
  async cimes_type({ selector, text: value, press_enter }) {
    const page = await mainPage();
    await page.locator(selector).first().fill(value, { timeout: 15_000 });
    if (press_enter) await page.keyboard.press("Enter");
    return text({ typed: selector });
  },
  async cimes_connect_albert({ api_key }) {
    const page = await mainPage();
    await page.waitForSelector("[data-testid=albert-onboarding]", {
      timeout: 30_000,
    });
    await page.fill("#albert-api-key", api_key);
    await page.click("[data-testid=albert-connect-button]");
    const result = await Promise.race([
      page
        .waitForSelector("[data-testid=albert-onboarding]", {
          state: "detached",
          timeout: 40_000,
        })
        .then(() => "connected"),
      page
        .waitForSelector("[data-testid=albert-error]", { timeout: 40_000 })
        .then(
          async (el) =>
            `error: ${(await el.textContent())?.replace(/\s+/g, " ")}`,
        ),
    ]).catch(() => "timeout");
    return text({ result });
  },
  cimes_send_prompt: (args) => sendPrompt(args),
  async cimes_read_chat() {
    return text(await chatText(await mainPage()));
  },
  async cimes_read_logs(args) {
    return text(readLogs(args));
  },
  async cimes_eval({ expression }) {
    const page = await mainPage();
    return text(await page.evaluate(`(async () => (${expression}))()`));
  },
  async cimes_close() {
    await state.browser?.close().catch(() => {});
    state.browser = null;
    if (state.child) {
      state.child.kill();
      state.child = null;
    }
    return text({ closed: true });
  },
};

const server = new Server(
  { name: "cimes-control", version: "1.0.0" },
  { capabilities: { tools: {} } },
);
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = handlers[request.params.name];
  if (!handler)
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool ${request.params.name}` }],
    };
  try {
    return await handler(request.params.arguments ?? {});
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
});
await server.connect(new StdioServerTransport());
process.on("exit", () => state.child?.kill());
