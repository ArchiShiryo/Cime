import fs from "node:fs";
import path from "node:path";
import { getUserDataPath } from "@/paths/paths";

export type ActivityKind =
  | "turn"
  | "tool"
  | "error"
  | "knowledge"
  | "ocr"
  | "gov"
  | "batch";
export type ActivityStatus = "start" | "ok" | "error";

export interface ActivityEvent {
  ts: string;
  kind: ActivityKind;
  name?: string;
  status?: ActivityStatus;
  ms?: number;
  chatId?: number;
  appId?: number;
  /** Short, redacted summary; never file contents. */
  detail?: string;
}

const FILE_NAME = "activity.jsonl";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DETAIL = 300;

export function getActivityLogPath(): string {
  return path.join(getUserDataPath(), "logs", FILE_NAME);
}

const SECRET_PATTERNS: [RegExp, string][] = [
  [/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, "$1-***"],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1***"],
  [
    /((?:api[_-]?key|token|secret|password|passwd|authorization)["']?\s*[:=]\s*["']?)[^\s"',}]{4,}/gi,
    "$1***",
  ],
];

/** Removes anything that looks like a credential and bounds the length. */
export function redact(text: string, max = MAX_DETAIL): string {
  let out = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s+/g, " ").trim();
  return out.length > max ? `${out.slice(0, max)}…` : out;
}

/** One-line summary of tool arguments: short values only, long text is cut. */
export function summarizeArgs(args: unknown): string {
  if (args === null || args === undefined) return "";
  if (typeof args !== "object") return redact(String(args));
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    const text =
      typeof value === "string"
        ? value.length > 80
          ? `${value.slice(0, 80)}… (${value.length} chars)`
          : value
        : JSON.stringify(value);
    parts.push(`${key}=${text.length > 100 ? `${text.slice(0, 100)}…` : text}`);
  }
  return redact(parts.join(" "));
}

function rotateIfNeeded(file: string): void {
  try {
    if (fs.statSync(file).size > MAX_BYTES) {
      fs.renameSync(file, `${file}.1`);
    }
  } catch {
    // missing file: nothing to rotate
  }
}

/** Appends one event. Never throws: the journal must not break the app. */
export function logActivity(event: Omit<ActivityEvent, "ts">): void {
  try {
    const file = getActivityLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    rotateIfNeeded(file);
    const line: ActivityEvent = {
      ts: new Date().toISOString(),
      ...event,
      detail: event.detail === undefined ? undefined : redact(event.detail),
    };
    fs.appendFileSync(file, JSON.stringify(line) + "\n", "utf8");
  } catch {
    // ignore
  }
}

/** Most recent events first. */
export function readActivity(
  limit = 300,
  options: { errorsOnly?: boolean } = {},
): ActivityEvent[] {
  const file = getActivityLogPath();
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const events: ActivityEvent[] = [];
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
    if (!lines[i]) continue;
    try {
      const event = JSON.parse(lines[i]) as ActivityEvent;
      if (
        options.errorsOnly &&
        event.status !== "error" &&
        event.kind !== "error"
      )
        continue;
      events.push(event);
    } catch {
      // partial line (crash while writing): skip
    }
  }
  return events;
}

export function clearActivity(): void {
  for (const file of [getActivityLogPath(), `${getActivityLogPath()}.1`]) {
    fs.rmSync(file, { force: true });
  }
}
