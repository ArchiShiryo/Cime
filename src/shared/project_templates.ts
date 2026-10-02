/** File-organisation templates offered when creating a project (generic, any public service). */
export interface ProjectTemplate {
  id: "libre" | "dossier" | "suivi" | "veille";
  name: string;
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
    name: "Projet libre",
    folders: [DOCUMENTATION_FOLDER, "En cours", "Livrables"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Range les brouillons dans « En cours » et les documents finalisés dans « Livrables ».",
  },
  {
    id: "dossier",
    name: "Dossier",
    folders: [DOCUMENTATION_FOLDER, "Sources", "Rédaction", "Versions finales"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Rédige dans un français administratif clair. Cite les pièces de « Documentation » quand tu t'y appuies. Place les versions validées dans « Versions finales ».",
  },
  {
    id: "suivi",
    name: "Suivi de projet",
    folders: [DOCUMENTATION_FOLDER, "Planning", "Comptes rendus", "Livrables"],
    skills: [...PROJECT_BASE_SKILLS, "tableau-de-bord-et-graphiques"],
    instructions:
      "Garde le planning à jour. Les comptes rendus vont dans « Comptes rendus ».",
  },
  {
    id: "veille",
    name: "Veille et étude",
    folders: [DOCUMENTATION_FOLDER, "Sources", "Notes", "Synthèses"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Cite toujours tes sources (fichier ou lien). Distingue ce qui vient des documents de ce qui vient du web.",
  },
];

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}
