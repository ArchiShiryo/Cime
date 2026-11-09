// Collects the English strings a user can see in the renderer: JSX text, text-like
// attributes (placeholder, title, aria-label…), toast messages and a few label-like
// object properties. Output: src/i18n/ui_strings_en.json (sorted, unique).
// Usage: node scripts/i18n/extract-ui-strings.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const DIRS = [
  "src/components",
  "src/pages",
  "src/app",
  "src/contexts",
  "src/hooks",
  "src/lib",
  "src/first_prompt",
  "src/package_manager_warnings",
  "src/prompts",
  "src/shared",
  "src/atoms",
  "src/ipc/shared",
  "src/pro/main/ipc/handlers/local_agent/tools",
];
const ATTRS = new Set([
  "placeholder",
  "title",
  "aria-label",
  "alt",
  "label",
  "description",
  "tooltip",
  "helperText",
  "emptyMessage",
  "confirmText",
  "cancelText",
  "heading",
  "subtitle",
  "caption",
  "content",
  "message",
  "enableLabel",
  "disableLabel",
  "actionLabel",
  "buttonLabel",
]);
const PROPS = new Set([
  "title",
  "label",
  "description",
  "placeholder",
  "subtitle",
  "tooltip",
  "message",
  "text",
  "header",
  "heading",
  "emptyText",
  "confirmText",
  "cancelText",
  "buttonText",
  "helpText",
  "hint",
  "name",
  "tab",
  "status",
  "emptyState",
]);
const TOAST_FNS = new Set([
  "showError",
  "showSuccess",
  "showInfo",
  "showWarning",
  "showMessage",
  "success",
  "error",
  "info",
  "warning",
  "message",
  "loading",
]);
const SKIP_FILE = /(\.test\.|\.spec\.|\.stories\.|__tests__|\.d\.ts$)/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry.name) && !SKIP_FILE.test(full))
      out.push(full);
  }
  return out;
}

const ENTITIES = {
  "&quot;": '"',
  "&amp;": "&",
  "&apos;": "'",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
};
const decode = (t) => t.replace(/&[a-z]+;|&#\d+;/gi, (e) => ENTITIES[e] ?? e);
const norm = (s) => decode(s).replace(/\s+/g, " ").trim();
/** Looks like a sentence or label a person reads (not a class list, id, path, url, code). */
function looksHuman(s) {
  if (s.length < 2 || s.length > 1200) return false;
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^(https?:|\/|\.\/|#|@|\$|[a-z]+:[a-z-]+)/i.test(s) && !/\s/.test(s))
    return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(s)) return false; // camelCase identifier / single lowercase token
  if (/^[a-z0-9_-]+$/.test(s) && !/\s/.test(s)) return false; // kebab/snake id
  if (/^[A-Z0-9_]+$/.test(s)) return false; // CONSTANT
  if (/[{}<>]/.test(s) && !/\s/.test(s)) return false;
  if (
    /(^|\s)(flex|grid|px-|py-|mt-|mb-|text-|bg-|border|rounded|w-|h-)[a-z0-9:-]*/.test(
      s,
    ) &&
    !/[A-Z][a-z]+ [a-z]+ [a-z]+/.test(s)
  )
    return false; // tailwind
  return true;
}

const found = new Set();
const add = (s) => {
  for (const part of Array.isArray(s) ? s : [s]) {
    const v = norm(part);
    if (looksHuman(v)) found.add(v);
  }
};

/** Every string literal that can end up as displayed text: through ?:, &&, ||, ??, +, parentheses and templates. */
function literalsOf(node, out = []) {
  if (!node) return out;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    out.push(node.text);
  else if (ts.isTemplateExpression(node)) {
    out.push(node.head.text);
    for (const span of node.templateSpans) out.push(span.literal.text);
  } else if (ts.isConditionalExpression(node)) {
    literalsOf(node.whenTrue, out);
    literalsOf(node.whenFalse, out);
  } else if (ts.isBinaryExpression(node)) {
    literalsOf(node.left, out);
    literalsOf(node.right, out);
  } else if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    literalsOf(node.expression, out);
  }
  return out;
}
const textOfExpr = (node) => {
  const all = literalsOf(node);
  return all.length ? all : null;
};

function visit(sf) {
  const rec = (node) => {
    if (ts.isJsxText(node)) {
      const parent = node.parent?.parent;
      const tag = ts.isJsxElement(parent)
        ? parent.openingElement.tagName.getText()
        : "";
      if (!/^(code|pre|kbd|style|script)$/.test(tag)) add(node.text);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText();
      if (ATTRS.has(name)) {
        const init = node.initializer;
        if (ts.isStringLiteral(init)) add(init.text);
        else if (ts.isJsxExpression(init) && init.expression) {
          const t = textOfExpr(init.expression);
          if (t !== null) add(t);
        }
      }
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      // {"literal text"} used as a child
      const t = textOfExpr(node.expression);
      if (t !== null) add(t);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const fname = ts.isPropertyAccessExpression(callee)
        ? callee.name.getText()
        : ts.isIdentifier(callee)
          ? callee.text
          : "";
      const owner = ts.isPropertyAccessExpression(callee)
        ? callee.expression.getText()
        : "";
      if (
        TOAST_FNS.has(fname) &&
        (/toast|sonner/i.test(owner) || /^show[A-Z]/.test(fname))
      ) {
        const first = node.arguments[0];
        const t = first && textOfExpr(first);
        if (t) add(t);
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      /^DESCRIPTION$|_DESCRIPTION$/.test(node.name.getText())
    ) {
      // Tool descriptions shown in Settings > Agent permissions.
      const t = textOfExpr(node.initializer);
      if (t !== null) add(t);
    } else if (
      (ts.isBindingElement(node) || ts.isParameter(node)) &&
      node.initializer &&
      PROPS.has(node.name.getText())
    ) {
      const t = textOfExpr(node.initializer);
      if (t !== null) add(t);
    } else if (
      ts.isArrayLiteralExpression(node) &&
      node.elements.length >= 2 &&
      node.elements.every(
        (e) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e),
      )
    ) {
      // Lists of sentences (rotating placeholders, loading messages): multi-word entries only.
      for (const e of node.elements) if (/\s/.test(e.text.trim())) add(e.text);
    } else if (
      ts.isPropertyAssignment(node) &&
      PROPS.has(node.name.getText().replace(/["']/g, ""))
    ) {
      const t = textOfExpr(node.initializer);
      if (t !== null) add(t);
    }
    ts.forEachChild(node, rec);
  };
  rec(sf);
}

let files = 0;
for (const dir of DIRS) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    files++;
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    visit(sf);
  }
}
// Cards the agent writes into the chat as XML (<dyad-status title="...">): displayed text.
function walkAll(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILE.test(full))
      out.push(full);
  }
  return out;
}
for (const file of walkAll(path.join(root, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(
    /<dyad-(?:status|output)[^>]*?\b(?:title|message)="([^"$\\]+)"/g,
  ))
    add(m[1]);
}
// Descriptions shown from backend data: built-in skills, bundled plugins, manual extras.
for (const dir of fs.readdirSync(path.join(root, "src/skills/builtin"), {
  withFileTypes: true,
})) {
  if (!dir.isDirectory()) continue;
  const file = path.join(root, "src/skills/builtin", dir.name, "SKILL.md");
  if (!fs.existsSync(file)) continue;
  const m = /^description:\s*(.+)$/m.exec(fs.readFileSync(file, "utf8"));
  if (m) add(m[1]);
}
const catalog = fs.readFileSync(
  path.join(root, "src/ipc/shared/bundled_mcp_catalog.ts"),
  "utf8",
);
for (const m of catalog.matchAll(
  /\b(?:name|description|category):\s*\n?\s*"([^"]+)"/g,
))
  add(m[1]);
const extras = path.join(root, "scripts/i18n/extra-strings.json");
if (fs.existsSync(extras))
  for (const t of JSON.parse(fs.readFileSync(extras, "utf8"))) add(t);
const list = [...found].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(
  path.join(root, "src/i18n/ui_strings_en.json"),
  JSON.stringify(list, null, 2) + "\n",
);
console.log(`${files} files, ${list.length} strings`);
