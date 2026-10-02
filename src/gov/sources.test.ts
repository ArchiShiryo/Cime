// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  getLegifranceArticle,
  searchAddress,
  searchCompanies,
  searchDatasets,
  searchDirectory,
  searchLegifrance,
  searchTenders,
  type FetchLike,
} from "./sources";

const reply = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});
const fetcher = (body: unknown, ok = true, status = 200) =>
  vi.fn<FetchLike>(async () => reply(body, ok, status));

describe("official data lookups", () => {
  it("formats data.gouv.fr datasets with publisher, date and files", async () => {
    const fetchImpl = fetcher({
      data: [
        {
          title: "Menus de cantine",
          organization: { name: "Mairie de Noé" },
          last_update: "2017-03-22T15:05:59",
          page: "https://www.data.gouv.fr/datasets/menu-cantine",
          description_short: "Menus",
          resources: [
            { title: "menu.csv", format: "csv", url: "https://x/menu.csv" },
          ],
        },
      ],
    });
    const out = await searchDatasets(fetchImpl, "cantine", 3);
    expect(out).toContain("Mairie de Noé");
    expect(out).toContain("https://www.data.gouv.fr/datasets/menu-cantine");
    expect(out).toContain("menu.csv [csv]");
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.hostname).toBe("www.data.gouv.fr");
    expect(url.searchParams.get("q")).toBe("cantine");
    expect(url.searchParams.get("page_size")).toBe("3");
  });

  it("parses the nested JSON fields of the service-public directory", async () => {
    const out = await searchDirectory(
      fetcher({
        total_count: 12,
        results: [
          {
            nom: "Mairie - Nanterre",
            adresse: JSON.stringify([
              {
                type_adresse: "Adresse",
                numero_voie: "1 place du 27 mars 2002",
                code_postal: "92000",
                nom_commune: "Nanterre",
              },
            ]),
            telephone: JSON.stringify([{ valeur: "01 47 29 50 50" }]),
            site_internet: JSON.stringify([
              { valeur: "https://www.nanterre.fr/" },
            ]),
            url_service_public: "https://lannuaire.service-public.gouv.fr/x",
          },
        ],
      }),
      "mairie nanterre",
    );
    expect(out).toContain("12 result(s)");
    expect(out).toContain("92000 Nanterre");
    expect(out).toContain("Tel 01 47 29 50 50");
    expect(out).toContain("https://lannuaire.service-public.gouv.fr/x");
  });

  it("never exposes the managers of a company", async () => {
    const out = await searchCompanies(
      fetcher({
        total_results: 1,
        results: [
          {
            nom_complet: "CANOPE",
            siren: "752155846",
            etat_administratif: "A",
            date_creation: "2012-01-01",
            siege: { adresse: "93 AV DE FRANCE", siret: "75215584600012" },
            dirigeants: [
              { nom: "DUPONT", prenoms: "MARIE", annee_de_naissance: "1970" },
            ],
          },
        ],
      }),
      "canope",
      { activeOnly: true },
    );
    expect(out).toContain("SIREN 752155846");
    expect(out).not.toMatch(/DUPONT|1970/);
  });

  it("formats addresses and tenders, and refuses a host that is not allowed", async () => {
    expect(
      await searchAddress(
        fetcher({
          features: [
            {
              properties: {
                label: "8 Rue du Port 92000 Nanterre",
                citycode: "92050",
                context: "92, Hauts-de-Seine",
                score: 0.64,
              },
              geometry: { coordinates: [2.17, 48.89] },
            },
          ],
        }),
        "8 rue du port nanterre",
      ),
    ).toContain("8 Rue du Port 92000 Nanterre");
    const tenders = fetcher({
      total_count: 1,
      results: [
        {
          objet: "Formation des agents",
          nomacheteur: "Mairie X",
          dateparution: "2026-10-01",
          datelimitereponse: "2026-11-01T12:00:00+00:00",
          url_avis: "https://www.boamp.fr/pages/avis/?q=idweb:26-1",
          code_departement: ["92"],
          type_marche: ["SERVICES"],
        },
      ],
    });
    const out = await searchTenders(tenders, 'forma"tion', {
      department: "92",
    });
    expect(out).toContain("Formation des agents");
    const where = new URL(tenders.mock.calls[0][0]).searchParams.get("where");
    expect(where).toBe('search(objet,"forma tion") AND code_departement="92"');
  });

  it("reports HTTP failures as errors", async () => {
    await expect(searchDatasets(fetcher({}, false, 503), "x")).rejects.toThrow(
      /503/,
    );
  });
});

describe("Légifrance (PISTE)", () => {
  const creds = { clientId: "id", clientSecret: "secret" };
  it("gets a token once, searches and reads an article", async () => {
    const calls: string[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("oauth.piste"))
        return reply({ access_token: "tok", expires_in: 3600 });
      if (url.endsWith("/search")) {
        expect(init?.headers?.Authorization).toBe("Bearer tok");
        expect(JSON.parse(init!.body!).fond).toBe("CODE_DATE");
        return reply({
          results: [
            {
              titles: [
                {
                  title: "Code du travail - Article L1221-1",
                  id: "LEGIARTI000006900848",
                  cid: "LEGITEXT000006072050",
                },
              ],
            },
          ],
        });
      }
      return reply({
        article: {
          num: "L1221-1",
          etat: "VIGUEUR",
          dateDebut: 1210000000000,
          texteHtml: "<p>Le contrat de travail</p>",
        },
      });
    };
    const search = await searchLegifrance(
      fetchImpl,
      creds,
      "contrat de travail",
      "codes",
      3,
    );
    expect(search).toContain("Article L1221-1");
    const article = await getLegifranceArticle(
      fetchImpl,
      creds,
      "LEGIARTI000006900848",
    );
    expect(article).toContain("Le contrat de travail");
    expect(article).toContain(
      "legifrance.gouv.fr/codes/article_lc/LEGIARTI000006900848",
    );
    expect(calls.filter((c) => c.includes("oauth"))).toHaveLength(1);
    await expect(
      getLegifranceArticle(fetchImpl, creds, "../etc"),
    ).rejects.toThrow(/LEGIARTI/);
  });
});
