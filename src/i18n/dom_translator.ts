/**
 * Applies an exact-match dictionary (English text -> French text) to what is shown
 * on screen. Most of the interface comes from Dyad with its strings written in the
 * components; translating at display time covers all of it, and keeps the fork easy
 * to merge with upstream. Only whole text nodes and text-like attributes are replaced,
 * never code, editors or the content of a conversation.
 */

const ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set([
  "CODE",
  "PRE",
  "KBD",
  "SCRIPT",
  "STYLE",
  "SVG",
  "NOSCRIPT",
]);
/** Their text is what the user typed, but their placeholder and title are interface. */
const FIELD_TAGS = new Set(["TEXTAREA", "INPUT"]);
/** Elements whose subtree must stay untouched. */
const SKIP_SELECTOR =
  "[data-no-translate], .monaco-editor, [contenteditable='true'], [data-lexical-editor]";

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

export interface DomTranslator {
  stop(): void;
}

export function startDomTranslation(
  dictionary: Record<string, string>,
  root: HTMLElement = document.body,
): DomTranslator {
  const originalText = new WeakMap<Node, string>();
  const originalAttr = new WeakMap<Element, Map<string, string>>();
  const touchedText = new Set<WeakRef<Node>>();
  const touchedElements = new Set<WeakRef<Element>>();
  let applying = false;

  const translate = (value: string): string | undefined => {
    const key = collapse(value);
    if (!key) return undefined;
    const french = dictionary[key];
    if (french === undefined || french === key) return undefined;
    // Keep the whitespace around the fragment: React splits sentences around variables.
    const lead = /^\s*/.exec(value)?.[0] ?? "";
    const trail = /\s*$/.exec(value)?.[0] ?? "";
    return `${lead}${french}${trail}`;
  };

  const skipped = (element: Element | null, attributes = false): boolean => {
    for (let el = element; el; el = el.parentElement) {
      const tag = el.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag)) return true;
      if (!attributes && FIELD_TAGS.has(tag)) return true;
    }
    return !!element?.closest(SKIP_SELECTOR);
  };

  const doText = (node: Text) => {
    if (skipped(node.parentElement)) return;
    const current = node.nodeValue ?? "";
    const known = originalText.get(node);
    // Already our output: nothing to do.
    if (known !== undefined && dictionary[collapse(known)] !== undefined) {
      const done = translate(known);
      if (done !== undefined && done === current) return;
    }
    const french = translate(current);
    if (french === undefined) return;
    originalText.set(node, current);
    touchedText.add(new WeakRef(node));
    node.nodeValue = french;
  };

  const doAttributes = (element: Element) => {
    // A rich-text editor's own placeholder is shown through an attribute too: keep translating it.
    if (skipped(element, true)) return;
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (!value) continue;
      const french = translate(value);
      if (french === undefined) continue;
      let saved = originalAttr.get(element);
      if (!saved) {
        saved = new Map();
        originalAttr.set(element, saved);
        touchedElements.add(new WeakRef(element));
      }
      if (!saved.has(name)) saved.set(name, value);
      element.setAttribute(name, french);
    }
  };

  const sweep = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      doText(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (skipped(element, true)) return;
    doAttributes(element);
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
      else doAttributes(n as Element);
    }
  };

  const pending = new Set<Node>();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    applying = true;
    try {
      for (const node of pending) {
        if (node.isConnected) sweep(node);
      }
    } finally {
      pending.clear();
      applying = false;
    }
  };
  const schedule = (node: Node) => {
    pending.add(node);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };

  const observer = new MutationObserver((records) => {
    if (applying) return;
    for (const record of records) {
      if (record.type === "childList") {
        record.addedNodes.forEach((added) => schedule(added));
      } else if (record.type === "characterData") {
        schedule(record.target);
      } else if (record.type === "attributes") {
        schedule(record.target);
      }
    }
  });

  sweep(root);
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRIBUTES],
  });

  return {
    stop() {
      observer.disconnect();
      pending.clear();
      for (const ref of touchedText) {
        const node = ref.deref();
        const original = node && originalText.get(node);
        if (node && original !== undefined) node.nodeValue = original;
      }
      for (const ref of touchedElements) {
        const element = ref.deref();
        const saved = element && originalAttr.get(element);
        if (element && saved) {
          for (const [name, value] of saved) element.setAttribute(name, value);
        }
      }
      touchedText.clear();
      touchedElements.clear();
    },
  };
}
