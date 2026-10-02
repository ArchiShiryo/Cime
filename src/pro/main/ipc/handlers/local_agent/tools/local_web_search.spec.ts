// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatSearchResults,
  parseBingResults,
  parseDuckDuckGoResults,
  parseSearxngResults,
  unwrapBingUrl,
  unwrapDuckDuckGoUrl,
} from "./local_web_search";

describe("DuckDuckGo", () => {
  it("unwraps redirect links", () => {
    expect(
      unwrapDuckDuckGoUrl(
        "//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Flearn&rut=abc",
      ),
    ).toBe("https://react.dev/learn");
    expect(unwrapDuckDuckGoUrl("https://example.com/x")).toBe(
      "https://example.com/x",
    );
    expect(unwrapDuckDuckGoUrl("https://duckduckgo.com/about")).toBeNull();
  });

  it("parses results and skips ads", () => {
    const html = `<div class="results">
      <div class="result result--ad"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fads.example">Ad</a></div>
      <div class="result"><h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Flearn">Quick Start &ndash; React</a></h2>
        <a class="result__snippet" href="x">An introduction   to React.</a></div>
      <div class="result"><a class="result__a" href="javascript:void(0)">Bad</a></div>
    </div>`;
    expect(parseDuckDuckGoResults(html)).toEqual([
      {
        title: "Quick Start – React",
        url: "https://react.dev/learn",
        snippet: "An introduction to React.",
      },
    ]);
  });
});

describe("Bing", () => {
  const target = "https://www.w3schools.com/react/";
  const encoded = "a1" + Buffer.from(target).toString("base64url");

  it("decodes tracking links", () => {
    expect(
      unwrapBingUrl(`https://www.bing.com/ck/a?!&&p=zz&u=${encoded}&ntb=1`),
    ).toBe(target);
    expect(unwrapBingUrl("https://example.com/page")).toBe(
      "https://example.com/page",
    );
    expect(unwrapBingUrl("https://www.bing.com/ck/a?u=notbase64")).toBeNull();
  });

  it("parses results", () => {
    const html = `<ol id="b_results"><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?!&&p=1&u=${encoded}&ntb=1"><strong>React</strong> Tutorial</a></h2>
      <div class="b_caption"><p class="b_lineclamp2">Learn React.</p></div></li>
      <li class="b_ad"><h2><a href="https://ad.example">Ad</a></h2></li></ol>`;
    expect(parseBingResults(html)).toEqual([
      { title: "React Tutorial", url: target, snippet: "Learn React." },
    ]);
  });
});

describe("SearXNG", () => {
  it("parses the JSON format and ignores malformed rows", () => {
    expect(
      parseSearxngResults({
        results: [
          { title: "A", url: "https://a.org", content: "alpha" },
          { title: "B", url: "ftp://b.org" },
          { url: "https://c.org" },
          null,
        ],
      }),
    ).toEqual([{ title: "A", url: "https://a.org", snippet: "alpha" }]);
    expect(parseSearxngResults({})).toEqual([]);
  });
});

describe("formatSearchResults", () => {
  it("numbers results and handles the empty case", () => {
    expect(
      formatSearchResults("q", [
        { title: "T", url: "https://t.org", snippet: "s" },
      ]),
    ).toBe("1. T\n   https://t.org\n   s");
    expect(formatSearchResults("réseau", [])).toBe(
      'No web results for "réseau".',
    );
  });
});
