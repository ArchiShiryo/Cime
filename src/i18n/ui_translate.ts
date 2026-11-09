import dictionary from "./ui_fr.json";

/**
 * Display-time translation for the few places that build or cut a sentence in code
 * (a rotating placeholder, a description cut to 100 characters), where the
 * translator working on the finished screen would see a fragment. Everything else is
 * handled by dom_translator.ts.
 */
const fr = dictionary as Record<string, string>;
// Set during the first render of the layout; English (no change) until then and in tests.
let language: "fr" | "en" = "en";

export function setUiLanguage(next: "fr" | "en"): void {
  language = next;
}

export function getUiDictionary(): Record<string, string> {
  return fr;
}

export function translateUi(text: string): string {
  if (language !== "fr") return text;
  return fr[text.replace(/\s+/g, " ").trim()] ?? text;
}
