// @vitest-environment node
// Hits the real public APIs. Run with: GOV_LIVE=1 npm test -- src/gov/sources.live.test.ts
import { describe, expect, it } from "vitest";
import {
  searchAddress,
  searchCompanies,
  searchDatasets,
  searchDirectory,
  searchTenders,
} from "./sources";

const live = (url: string, init?: object) => fetch(url, init as RequestInit);

describe.skipIf(!process.env.GOV_LIVE)("official APIs (live)", () => {
  it("answers on every source", async () => {
    const outputs = {
      datasets: await searchDatasets(live, "cantine scolaire", 2),
      directory: await searchDirectory(live, "mairie nanterre", 2),
      companies: await searchCompanies(live, "canope", { limit: 2 }),
      address: await searchAddress(live, "8 rue du port nanterre"),
      tenders: await searchTenders(live, "formation", { limit: 2 }),
    };
    for (const [name, text] of Object.entries(outputs)) {
      console.log(`\n### ${name}\n${text}`);
      expect(text.length, name).toBeGreaterThan(30);
      expect(text, name).not.toMatch(/^No /);
    }
  }, 120_000);
});
