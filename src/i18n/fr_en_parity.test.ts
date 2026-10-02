import { describe, expect, it } from "vitest";
import enCimes from "./locales/en/cimes.json";
import frCimes from "./locales/fr/cimes.json";
import enChat from "./locales/en/chat.json";
import frChat from "./locales/fr/chat.json";
import enCommon from "./locales/en/common.json";
import frCommon from "./locales/fr/common.json";
import enErrors from "./locales/en/errors.json";
import frErrors from "./locales/fr/errors.json";
import enHome from "./locales/en/home.json";
import frHome from "./locales/fr/home.json";
import enSettings from "./locales/en/settings.json";
import frSettings from "./locales/fr/settings.json";

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ""): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [[`${prefix}${key}`, value] as [string, string]]
      : flatten(value, `${prefix}${key}.`),
  );

const placeholders = (text: string) =>
  (text.match(/\{\{[^}]+\}\}|<\/?\d+>/g) ?? []).sort().join("|");

const PAIRS = {
  cimes: [enCimes, frCimes],
  chat: [enChat, frChat],
  common: [enCommon, frCommon],
  errors: [enErrors, frErrors],
  home: [enHome, frHome],
  settings: [enSettings, frSettings],
} as const;

describe.each(Object.entries(PAIRS))("fr/%s", (_name, [en, fr]) => {
  const english = new Map(flatten(en as Tree));
  const french = new Map(flatten(fr as Tree));

  it("has exactly the keys English has", () => {
    expect([...french.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("keeps every interpolation placeholder", () => {
    for (const [key, value] of english) {
      expect(placeholders(french.get(key) ?? ""), key).toBe(
        placeholders(value),
      );
    }
  });
});
