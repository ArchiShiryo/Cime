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
      "Up-to-date documentation for libraries and frameworks (React, Vite, Tailwind…), so the agent does not invent APIs.",
    category: "Documentation",
    featured: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@upstash/context7-mcp@4.1.1"],
  },
  {
    slug: "memory",
    name: "Memory",
    description:
      "Local knowledge graph: the agent remembers facts (preferences, decisions) from one conversation to the next.",
    category: "Memory",
    featured: true,
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory@2026.8.31"],
  },
  {
    slug: "sequential-thinking",
    name: "Step-by-step reasoning",
    description:
      "Helps the agent break a complex problem into steps and revise its reasoning.",
    category: "Reasoning",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking@2026.8.31"],
  },
  {
    slug: "playwright",
    name: "Browser (Playwright)",
    description:
      "Drives a real browser to test the generated app (clicks, forms, screenshots). Downloads a browser on first use.",
    category: "Browser",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@playwright/mcp@0.0.83"],
  },
];
