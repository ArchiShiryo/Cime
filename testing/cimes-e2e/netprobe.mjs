// Lists every host the packaged app tries to reach on its own (no user action).
// Dyad's domains are pointed at a local listener (/etc/hosts, needs root) so any
// connection attempt is logged; Chromium's net-log captures the rest.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const exe = process.argv[2];
const seconds = Number(process.env.PROBE_SECONDS || 75);
const home = fs.mkdtempSync(path.join(os.tmpdir(), "cimes-probe-"));
const netlog = path.join(home, "netlog.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DYAD_HOSTS = [
  "api.dyad.sh",
  "engine.dyad.sh",
  "academy.dyad.sh",
  "oauth.dyad.sh",
  "supabase-oauth.dyad.sh",
  "dyad.sh",
  "www.dyad.sh",
  "docs.dyad.sh",
];
const marker = "# cimes-netprobe";
const hits = [];
const servers = [];
for (const port of [443, 80]) {
  const server = net.createServer((socket) => {
    socket.once("data", (buffer) => {
      const text = buffer.toString("latin1");
      const sni = /\x00\x00([a-z0-9.-]+\.[a-z]{2,})/i.exec(text)?.[1];
      const host = /Host: ([^\r\n]+)/i.exec(text)?.[1];
      hits.push(`${port} ${host ?? sni ?? "?"}`);
      socket.destroy();
    });
    socket.on("error", () => {});
  });
  server.listen(port, "127.0.0.1");
  servers.push(server);
}
const hosts = fs.readFileSync("/etc/hosts", "utf8");
fs.writeFileSync(
  "/etc/hosts",
  hosts + DYAD_HOSTS.map((h) => `127.0.0.1 ${h} ${marker}\n`).join(""),
);
const cleanup = () =>
  fs.writeFileSync(
    "/etc/hosts",
    fs
      .readFileSync("/etc/hosts", "utf8")
      .split("\n")
      .filter((l) => !l.includes(marker))
      .join("\n"),
  );

// Self-test: the listener must see a connection to a Dyad domain.
await new Promise((resolve) => {
  const probe = net.connect(443, "api.dyad.sh", () => {
    probe.write("GET / HTTP/1.1\r\nHost: api.dyad.sh\r\n\r\n");
    setTimeout(resolve, 300);
  });
  probe.on("error", resolve);
});
console.log("self-test hits:", JSON.stringify(hits));

const userData = path.join(home, ".config", "Cimes");
const env = {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: path.join(home, ".config"),
  ALBERT_API_KEY: "",
};
for (const k of [
  "HTTPS_PROXY",
  "https_proxy",
  "HTTP_PROXY",
  "http_proxy",
  "ALL_PROXY",
])
  delete env[k];
const launch = () =>
  spawn(
    exe,
    ["--no-sandbox", "--remote-debugging-port=9335", `--log-net-log=${netlog}`],
    { env, stdio: "ignore" },
  );
try {
  // First run creates settings; seed a fake key so the onboarding gate is skipped.
  const first = launch();
  const settingsFile = path.join(userData, "user-settings.json");
  for (let i = 0; i < 60 && !fs.existsSync(settingsFile); i++) await sleep(500);
  await sleep(4000);
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
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"])
    fs.rmSync(path.join(userData, f), { force: true });
  hits.length = 0;
  fs.rmSync(netlog, { force: true });

  const proc = launch();
  let browser;
  for (let i = 0; i < 60 && !browser; i++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9335");
    } catch {
      await sleep(500);
    }
  }
  const pages = () => browser.contexts().flatMap((c) => c.pages());
  let main;
  for (let i = 0; i < 80 && !main; i++) {
    main = pages().find(
      (p) =>
        !p.url().includes("cimes-splash") && !p.url().startsWith("devtools"),
    );
    if (!main) await sleep(500);
  }
  await sleep(8000);
  for (const route of [
    "/",
    "/settings",
    "/templates",
    "/plugins",
    "/documents",
    "/skills",
    "/library",
  ]) {
    await main.evaluate(
      (r) => document.querySelector(`a[href="${r}"]`)?.click(),
      route,
    );
    await sleep(3000);
  }
  await sleep(Math.max(0, seconds - 30) * 1000);
  await browser.close().catch(() => {});
  proc.kill();
  await sleep(2000);
} finally {
  cleanup();
  servers.forEach((s) => s.close());
}
console.log(
  "Connections to Dyad domains (should be empty):",
  JSON.stringify([...new Set(hits)]),
);
let urls = [];
try {
  // The net-log is written as JSON but may end abruptly; read URLs with a regex.
  urls = [
    ...fs.readFileSync(netlog, "utf8").matchAll(/"url":"(https?:[^"]+)"/g),
  ].map((m) => m[1]);
} catch (error) {
  console.log("net-log unreadable:", error.message);
}
const byHost = {};
for (const u of urls) {
  const h = new URL(u).host;
  byHost[h] = (byHost[h] ?? 0) + 1;
}
console.log("Hosts seen by Chromium:", JSON.stringify(byHost));
