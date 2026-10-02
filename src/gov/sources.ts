/**
 * Read-only lookups in official French public data. Every call goes to a fixed
 * public host (no key), through the app's own network stack so the proxy of a
 * locked-down PC is honoured. Results are returned as short Markdown with the
 * official URL, ready for the agent to cite.
 */
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const HOSTS = new Set([
  "www.data.gouv.fr",
  "recherche-entreprises.api.gouv.fr",
  "api-adresse.data.gouv.fr",
  "api-lannuaire.service-public.fr",
  "boamp-datadila.opendatasoft.com",
  "oauth.piste.gouv.fr",
  "api.piste.gouv.fr",
]);
const MAX_LIMIT = 10;
const TIMEOUT_MS = 20_000;

const clampLimit = (limit: number | undefined, fallback = 5) =>
  Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit ?? fallback)));
const cut = (text: unknown, max = 300) => {
  const value =
    typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

async function getJson(
  fetchImpl: FetchLike,
  base: string,
  params: Record<string, string | undefined>,
  signal?: AbortSignal,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<any> {
  const url = new URL(base);
  if (!HOSTS.has(url.hostname)) {
    throw new DyadError(
      `Host not allowed: ${url.hostname}`,
      DyadErrorKind.Validation,
    );
  }
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetchImpl(url.toString(), {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new DyadError(
      `${url.hostname} answered HTTP ${response.status}`,
      DyadErrorKind.External,
    );
  }
  return response.json();
}

/** Opendatasoft full-text search needs double quotes escaped. */
const odsSearch = (query: string, field?: string) =>
  `search(${field ? `${field},` : ""}"${query.replace(/["\\]/g, " ").trim()}")`;

// ------------------------------------------------------------ data.gouv.fr

export async function searchDatasets(
  fetchImpl: FetchLike,
  query: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<string> {
  const data = await getJson(
    fetchImpl,
    "https://www.data.gouv.fr/api/1/datasets/",
    { q: query, page_size: String(clampLimit(limit)) },
    signal,
  );
  const items = (data?.data ?? []) as any[];
  if (items.length === 0) return "No dataset found on data.gouv.fr.";
  return items
    .map((d, i) => {
      const resources = ((d.resources ?? []) as any[])
        .slice(0, 4)
        .map((r) => `  - ${cut(r.title, 80)} [${r.format ?? "?"}] ${r.url}`)
        .join("\n");
      return `${i + 1}. **${cut(d.title, 120)}** — ${d.organization?.name ?? "unknown publisher"}
   Updated: ${(d.last_update ?? "").slice(0, 10)} · ${d.page}
   ${cut(d.description_short ?? d.description, 250)}
${resources ? `   Files:\n${resources}` : ""}`;
    })
    .join("\n\n");
}

// ------------------------------------------------- annuaire service-public

const parseJsonField = (value: unknown): any[] => {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export async function searchDirectory(
  fetchImpl: FetchLike,
  query: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<string> {
  const data = await getJson(
    fetchImpl,
    "https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records",
    { where: odsSearch(query), limit: String(clampLimit(limit)) },
    signal,
  );
  const items = (data?.results ?? []) as any[];
  if (items.length === 0)
    return "No public service found in the official directory.";
  const lines = items.map((s, i) => {
    const address =
      parseJsonField(s.adresse).find((a) => a.type_adresse === "Adresse") ??
      parseJsonField(s.adresse)[0];
    const phone = parseJsonField(s.telephone)[0]?.valeur;
    const site = parseJsonField(s.site_internet)[0]?.valeur;
    const hours = parseJsonField(s.plage_ouverture)
      .slice(0, 3)
      .map(
        (h) =>
          `${h.nom_jour_debut}${h.nom_jour_fin !== h.nom_jour_debut ? `-${h.nom_jour_fin}` : ""} ${String(h.valeur_heure_debut_1).slice(0, 5)}-${String(h.valeur_heure_fin_1).slice(0, 5)}`,
      )
      .join(", ");
    return `${i + 1}. **${cut(s.nom, 120)}**${s.sigle ? ` (${s.sigle})` : ""}
   ${address ? `${address.numero_voie} ${address.code_postal} ${address.nom_commune}` : "address not given"}
   ${[phone && `Tel ${phone}`, s.adresse_courriel && `Email ${s.adresse_courriel}`, site && `Web ${site}`].filter(Boolean).join(" · ")}
   ${hours ? `Hours: ${hours}` : ""}
   ${cut(s.mission, 200)}
   Source: ${s.url_service_public ?? "https://lannuaire.service-public.gouv.fr"}`;
  });
  return `${data.total_count} result(s), first ${items.length}:\n\n${lines.join("\n\n")}`;
}

// ------------------------------------------------ annuaire des entreprises

export async function searchCompanies(
  fetchImpl: FetchLike,
  query: string,
  options: { limit?: number; postalCode?: string; activeOnly?: boolean } = {},
  signal?: AbortSignal,
): Promise<string> {
  const data = await getJson(
    fetchImpl,
    "https://recherche-entreprises.api.gouv.fr/search",
    {
      q: query,
      per_page: String(clampLimit(options.limit)),
      code_postal: options.postalCode,
      etat_administratif: options.activeOnly ? "A" : undefined,
    },
    signal,
  );
  const items = (data?.results ?? []) as any[];
  if (items.length === 0) return "No organisation found.";
  const lines = items.map((c, i) => {
    const seat = c.siege ?? {};
    return `${i + 1}. **${cut(c.nom_complet, 120)}** — SIREN ${c.siren}${seat.siret ? ` · SIRET (HQ) ${seat.siret}` : ""}
   Status: ${c.etat_administratif === "A" ? "active" : "ceased"} · created ${c.date_creation ?? "?"} · legal form code ${c.nature_juridique ?? "?"} · NAF ${c.activite_principale ?? "?"}
   HQ: ${cut(seat.adresse, 160)}
   Size: ${c.tranche_effectif_salarie ?? "n/a"} · open sites: ${c.nombre_etablissements_ouverts ?? "?"}
   Source: https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`;
  });
  return `${data.total_results ?? items.length} result(s), first ${items.length}:\n\n${lines.join("\n\n")}`;
}

// --------------------------------------------------------------- adresses

export async function searchAddress(
  fetchImpl: FetchLike,
  query: string,
  limit?: number,
  signal?: AbortSignal,
): Promise<string> {
  const data = await getJson(
    fetchImpl,
    "https://api-adresse.data.gouv.fr/search/",
    { q: query, limit: String(clampLimit(limit, 3)) },
    signal,
  );
  const items = (data?.features ?? []) as any[];
  if (items.length === 0) return "No address found.";
  return items
    .map((f, i) => {
      const p = f.properties ?? {};
      const [lon, lat] = f.geometry?.coordinates ?? [];
      return `${i + 1}. ${p.label} — INSEE ${p.citycode}, ${p.context} · lat ${lat}, lon ${lon} · score ${Math.round((p.score ?? 0) * 100)}%`;
    })
    .join("\n");
}

// ------------------------------------------------------------------ BOAMP

export async function searchTenders(
  fetchImpl: FetchLike,
  query: string,
  options: { limit?: number; department?: string } = {},
  signal?: AbortSignal,
): Promise<string> {
  const where = [
    odsSearch(query, "objet"),
    options.department
      ? `code_departement="${options.department.replace(/[^0-9AB]/gi, "")}"`
      : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  const data = await getJson(
    fetchImpl,
    "https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records",
    {
      where,
      order_by: "dateparution desc",
      limit: String(clampLimit(options.limit)),
      select:
        "idweb,objet,nomacheteur,dateparution,datelimitereponse,famille_libelle,nature_libelle,type_marche,code_departement,url_avis",
    },
    signal,
  );
  const items = (data?.results ?? []) as any[];
  if (items.length === 0)
    return "No public procurement notice found in the BOAMP.";
  const lines = items.map(
    (n, i) =>
      `${i + 1}. **${cut(n.objet, 200)}**
   Buyer: ${n.nomacheteur ?? "?"} · published ${n.dateparution ?? "?"} · deadline ${(n.datelimitereponse ?? "none").toString().slice(0, 16)}
   ${n.nature_libelle ?? ""} · ${(n.type_marche ?? []).join("/")} · dept ${(n.code_departement ?? []).join(",")}
   Source: ${n.url_avis}`,
  );
  return `${data.total_count} notice(s), newest first (${items.length} shown):\n\n${lines.join("\n\n")}`;
}

// -------------------------------------------------------------- Légifrance

export interface PisteCredentials {
  clientId: string;
  clientSecret: string;
}

const LEGIFRANCE_API =
  "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";
let tokenCache: { key: string; token: string; expires: number } | null = null;

async function pisteToken(
  fetchImpl: FetchLike,
  creds: PisteCredentials,
  signal?: AbortSignal,
): Promise<string> {
  const key = `${creds.clientId}:${creds.clientSecret}`;
  if (
    tokenCache &&
    tokenCache.key === key &&
    tokenCache.expires > Date.now() + 30_000
  ) {
    return tokenCache.token;
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "openid",
  }).toString();
  const data = await getJson(
    fetchImpl,
    "https://oauth.piste.gouv.fr/api/oauth/token",
    {},
    signal,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!data?.access_token) {
    throw new DyadError("PISTE did not return a token", DyadErrorKind.Auth);
  }
  tokenCache = {
    key,
    token: data.access_token,
    expires: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return data.access_token;
}

async function legifrancePost(
  fetchImpl: FetchLike,
  creds: PisteCredentials,
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<any> {
  const token = await pisteToken(fetchImpl, creds, signal);
  return getJson(fetchImpl, `${LEGIFRANCE_API}${endpoint}`, {}, signal, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export const LEGIFRANCE_FUNDS = {
  codes: "CODE_DATE",
  laws: "LODA_DATE",
  caselaw: "JURI",
  council_of_state: "CETAT",
  constitutional_council: "CONSTIT",
  collective_agreements: "KALI",
  official_journal: "JORF",
} as const;
export type LegifranceFund = keyof typeof LEGIFRANCE_FUNDS;

export async function searchLegifrance(
  fetchImpl: FetchLike,
  creds: PisteCredentials,
  query: string,
  fund: LegifranceFund,
  limit?: number,
  signal?: AbortSignal,
): Promise<string> {
  const data = await legifrancePost(
    fetchImpl,
    creds,
    "/search",
    {
      fond: LEGIFRANCE_FUNDS[fund],
      recherche: {
        champs: [
          {
            typeChamp: "ALL",
            criteres: [
              {
                typeRecherche: "TOUS_LES_MOTS_DANS_UN_CHAMP",
                valeur: query,
                operateur: "ET",
              },
            ],
            operateur: "ET",
          },
        ],
        filtres: [],
        pageNumber: 1,
        pageSize: clampLimit(limit),
        operateur: "ET",
        sort: "PERTINENCE",
        typePagination: "DEFAUT",
      },
    },
    signal,
  );
  const results = (data?.results ?? []) as any[];
  if (results.length === 0) return "No result in Légifrance.";
  return results
    .map((r, i) => {
      const titles = (r.titles ?? []) as any[];
      const first = titles[0] ?? {};
      return `${i + 1}. **${cut(first.title ?? r.title ?? r.nor ?? "Untitled", 160)}**
   id: ${first.cid ?? first.id ?? r.id ?? "?"}${first.id && first.id !== first.cid ? ` (article id: ${first.id})` : ""} · ${r.nature ?? ""} ${r.date ?? ""}
   ${cut(
     (r.sections ?? [])
       .flatMap((s: any) => s.extracts ?? [])
       .map((e: any) => e.values?.join(" "))
       .filter(Boolean)
       .join(" … "),
     300,
   )}`;
    })
    .join("\n\n");
}

export async function getLegifranceArticle(
  fetchImpl: FetchLike,
  creds: PisteCredentials,
  id: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!/^LEGIARTI\d{12}$/.test(id)) {
    throw new DyadError(
      "An article id looks like LEGIARTI000006419280 (use legifrance_search to find it)",
      DyadErrorKind.Validation,
    );
  }
  const data = await legifrancePost(
    fetchImpl,
    creds,
    "/consult/getArticle",
    { id },
    signal,
  );
  const article = data?.article;
  if (!article) return "Article not found.";
  const strip = (html: unknown) =>
    String(html ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();
  return `Article ${article.num ?? ""} — ${article.etat ?? ""}
In force from ${article.dateDebut ? new Date(article.dateDebut).toISOString().slice(0, 10) : "?"}${article.dateFin ? ` to ${new Date(article.dateFin).toISOString().slice(0, 10)}` : ""}

${strip(article.texteHtml ?? article.texte)}

Source: https://www.legifrance.gouv.fr/codes/article_lc/${id}`;
}
