import type { McpCatalogEntry } from "@/ipc/types/mcp_catalog";

/**
 * MCP servers offered in Cimes without contacting any Dyad service. All run
 * locally through npx with pinned versions (Node.js is required on the PC).
 */
export const BUNDLED_MCP_CATALOG: McpCatalogEntry[] = [
  {
    slug: "context7",
    name: "Context7",
    description:
      "Documentation à jour des bibliothèques et frameworks (React, Vite, Tailwind…), pour que l'agent n'invente pas d'API.",
    category: "Documentation",
    featured: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@4.1.1"],
  },
  {
    slug: "memory",
    name: "Mémoire",
    description:
      "Graphe de connaissances local : l'agent retient des faits (préférences, décisions) d'une conversation à l'autre.",
    category: "Mémoire",
    featured: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory@2026.8.31"],
  },
  {
    slug: "sequential-thinking",
    name: "Raisonnement pas à pas",
    description:
      "Aide l'agent à décomposer un problème complexe en étapes et à réviser son raisonnement.",
    category: "Raisonnement",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking@2026.8.31"],
  },
  {
    slug: "playwright",
    name: "Navigateur (Playwright)",
    description:
      "Pilote un vrai navigateur pour tester l'application générée (clics, formulaires, captures). Télécharge un navigateur au premier usage.",
    category: "Navigateur",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@0.0.83"],
  },
];
