// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { startDomTranslation } from "./dom_translator";

const dictionary = {
  Back: "Retour",
  "Describe your idea.": "Décrivez votre idée.",
  Search: "Rechercher",
  Version: "Version",
  and: "et",
};

const mount = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("startDomTranslation", () => {
  it("translates text nodes and text-like attributes already on screen", () => {
    const host = mount(
      `<button>  Back </button><input placeholder="Search" /><p title="Describe your idea.">Describe your idea.</p>`,
    );
    const t = startDomTranslation(dictionary, host);
    expect(host.querySelector("button")!.textContent).toBe("  Retour ");
    expect(host.querySelector("input")!.getAttribute("placeholder")).toBe(
      "Rechercher",
    );
    expect(host.querySelector("p")!.getAttribute("title")).toBe(
      "Décrivez votre idée.",
    );
    t.stop();
  });

  it("translates what React adds later and what it rewrites", async () => {
    const host = mount(`<div id="root"></div>`);
    const t = startDomTranslation(dictionary, host);
    const span = document.createElement("span");
    span.textContent = "Back";
    host.querySelector("#root")!.appendChild(span);
    await tick();
    expect(span.textContent).toBe("Retour");
    span.firstChild!.nodeValue = "Search";
    await tick();
    expect(span.textContent).toBe("Rechercher");
    t.stop();
  });

  it("never touches code, editors, inputs or the content of a conversation", () => {
    const host = mount(
      `<pre>Back</pre><code>Back</code><textarea>Back</textarea><div class="monaco-editor">Back</div><div data-no-translate>Back</div><div contenteditable="true">Back</div><p>Back to the future</p>`,
    );
    const t = startDomTranslation(dictionary, host);
    expect(host.textContent).toBe("BackBackBackBackBackBackBack to the future");
    t.stop();
  });

  it("only replaces whole fragments and leaves the rest alone", () => {
    const host = mount(`<p>Version <b>2</b> and more</p>`);
    const t = startDomTranslation(dictionary, host);
    expect(host.querySelector("p")!.textContent).toBe("Version 2 and more");
    t.stop();
  });

  it("restores the English text when stopped", () => {
    const host = mount(`<button>Back</button><input placeholder="Search" />`);
    const t = startDomTranslation(dictionary, host);
    expect(host.textContent).toBe("Retour");
    t.stop();
    expect(host.querySelector("button")!.textContent).toBe("Back");
    expect(host.querySelector("input")!.getAttribute("placeholder")).toBe(
      "Search",
    );
  });
});
