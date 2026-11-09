---
name: sources-officielles
description: Look up official French public information with its source: law (Légifrance), open data (data.gouv.fr), the directory of public services, organisations and companies (SIREN/SIRET), postal addresses and public procurement notices (BOAMP). Use whenever a question concerns a French administration, a legal text, a company, an address, a tender or public statistics.
---

# Official sources

Two tools give access to official databases. Prefer them to a general web search for these topics: results are structured and always carry the official link.

## `official_data` (no key needed)

| source      | use it for                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `directory` | find a mairie, préfecture, ministry service, school administration: address, phone, opening hours |
| `companies` | check an organisation or company by name, SIREN or SIRET: status, address, creation date          |
| `addresses` | normalise a postal address, get the INSEE city code and coordinates                               |
| `datasets`  | find open data (statistics, budgets, lists) and the file links                                    |
| `tenders`   | find public procurement notices (BOAMP): buyer, deadline, link                                    |

Tips: write queries in French; add `department` for tenders and `postal_code` for companies; try another wording if there is no result.

## `legifrance` (only when the user configured it in Settings)

1. `action=search` with the topic words and a `fund` (`codes` by default; `laws`, `caselaw`, `collective_agreements`, `official_journal`…).
2. `action=article` with a `LEGIARTI…` id from the results to read the full text and its dates in force.

If the tool is not available, say that Légifrance is not configured and use `web_search` / `web_fetch` on legifrance.gouv.fr instead, flagging that the text must be checked.

## Rules

1. **Cite** every fact with its Source link and quote legal text literally; do not paraphrase an article as if it were the text.
2. Check the **dates**: a legal article may no longer be in force; say which version you read.
3. Official data can be out of date or incomplete: state the date shown by the source.
4. This is information, not legal advice: for a decision with legal effect, recommend a check by the service in charge.
5. Never copy personal data found in these sources into a document unless the user needs it for their task.
