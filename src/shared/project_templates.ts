/** File-organisation templates offered when creating a project (generic, any public service). */
export interface ProjectTemplate {
  id: "libre" | "dossier" | "suivi" | "veille";
  /** Folders created in the project (relative, forward slashes). */
  folders: string[];
  /** Skills enabled by default for this kind of project. */
  skills: string[];
  /** Short guidance given to the assistant for every conversation of the project. */
  instructions: string;
}

export const DOCUMENTATION_FOLDER = "Documentation";
export const PROJECT_BASE_SKILLS = ["office-fichiers", "recherche-web-sourcee"];

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: "libre",
    folders: [DOCUMENTATION_FOLDER, "Work in progress", "Deliverables"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      'Keep drafts in "Work in progress" and finished documents in "Deliverables".',
  },
  {
    id: "dossier",
    folders: [DOCUMENTATION_FOLDER, "Sources", "Drafting", "Final versions"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      'Write in clear administrative language. Cite the documents in "Documentation" when you rely on them. Put approved versions in "Final versions".',
  },
  {
    id: "suivi",
    folders: [DOCUMENTATION_FOLDER, "Planning", "Minutes", "Deliverables"],
    skills: [...PROJECT_BASE_SKILLS, "tableau-de-bord-et-graphiques"],
    instructions:
      'Keep the planning up to date. Meeting minutes go in "Minutes".',
  },
  {
    id: "veille",
    folders: [DOCUMENTATION_FOLDER, "Sources", "Notes", "Summaries"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Always cite your sources (file or link). Distinguish what comes from the documents from what comes from the web.",
  },
];

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}
