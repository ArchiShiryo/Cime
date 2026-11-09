// Papers behind the two ways of working (Projects, Apps). Every entry was
// checked against arXiv; keep titles exact when adding more.
export type ResearchNoteId = "projects" | "apps";

export interface ResearchSource {
  title: string;
  authors: string;
  year: number;
  url: string;
}

export const RESEARCH_SOURCES: Record<ResearchNoteId, ResearchSource[]> = {
  projects: [
    {
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
      authors: "Lewis et al.",
      year: 2020,
      url: "https://arxiv.org/abs/2005.11401",
    },
    {
      title: "MemGPT: Towards LLMs as Operating Systems",
      authors: "Packer et al.",
      year: 2023,
      url: "https://arxiv.org/abs/2310.08560",
    },
    {
      title: "ReAct: Synergizing Reasoning and Acting in Language Models",
      authors: "Yao et al.",
      year: 2022,
      url: "https://arxiv.org/abs/2210.03629",
    },
  ],
  apps: [
    {
      title: "Executable Code Actions Elicit Better LLM Agents",
      authors: "Wang et al.",
      year: 2024,
      url: "https://arxiv.org/abs/2402.01030",
    },
    {
      title:
        "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering",
      authors: "Yang et al.",
      year: 2024,
      url: "https://arxiv.org/abs/2405.15793",
    },
    {
      title: "ReAct: Synergizing Reasoning and Acting in Language Models",
      authors: "Yao et al.",
      year: 2022,
      url: "https://arxiv.org/abs/2210.03629",
    },
  ],
};
