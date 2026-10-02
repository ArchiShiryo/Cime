/** File-organisation templates offered when creating a project (generalist: public-service work). */
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
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
    id: "vierge",
    name: "Projet libre",
    description:
      "Un dossier simple : Documentation, Travail en cours, Livrables.",
    folders: [DOCUMENTATION_FOLDER, "Travail en cours", "Livrables"],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Range les brouillons dans « Travail en cours » et les documents finalisés dans « Livrables ».",
  },
  {
    id: "dossier-administratif",
    name: "Dossier administratif",
    description:
      "Notes, courriers, comptes rendus et pièces d'un dossier : sources, rédaction, versions finales.",
    folders: [
      DOCUMENTATION_FOLDER,
      "Pièces et sources",
      "Rédaction",
      "Courriers et notes",
      "Versions finales",
    ],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Rédige dans un français administratif clair. Cite les pièces de « Documentation » quand tu t'y appuies. Place les versions validées dans « Versions finales ».",
  },
  {
    id: "formation",
    name: "Formation / atelier",
    description:
      "Préparer une formation : référentiels, déroulé, supports, évaluations, preuves (Qualiopi).",
    folders: [
      DOCUMENTATION_FOLDER,
      "Référentiels et preuves Qualiopi",
      "Déroulé pédagogique",
      "Supports",
      "Évaluations",
      "Émargements et bilans",
    ],
    skills: [
      ...PROJECT_BASE_SKILLS,
      "atelier-pedagogique",
      "fiche-imprimable-a4",
      "quiz-et-jeux-pedagogiques",
      "charte-canope",
    ],
    instructions:
      "Appuie-toi sur les référentiels de « Documentation » pour les objectifs, indicateurs et preuves. Produis des documents prêts à imprimer dans « Supports ».",
  },
  {
    id: "marche-public",
    name: "Marché public / achat",
    description:
      "Consultation et achat : besoin, cahier des charges, analyse des offres, pièces du marché.",
    folders: [
      DOCUMENTATION_FOLDER,
      "Expression du besoin",
      "Pièces de la consultation",
      "Offres reçues",
      "Analyse et rapport",
      "Notification",
    ],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Les règles de la commande publique sont dans « Documentation ». Ne conclus jamais sur la régularité d'une procédure sans citer le texte ou la pièce.",
  },
  {
    id: "pilotage",
    name: "Pilotage de projet de service",
    description:
      "Suivi d'un projet : cadrage, planning, comités, indicateurs, tableaux de bord.",
    folders: [
      DOCUMENTATION_FOLDER,
      "Cadrage",
      "Planning et suivi",
      "Comités et comptes rendus",
      "Indicateurs",
      "Livrables",
    ],
    skills: [...PROJECT_BASE_SKILLS, "tableau-de-bord-et-graphiques"],
    instructions:
      "Garde le suivi à jour dans « Planning et suivi ». Les comptes rendus vont dans « Comités et comptes rendus ».",
  },
  {
    id: "veille-etude",
    name: "Veille et étude",
    description:
      "Rechercher, lire et synthétiser : sources collectées, notes de lecture, synthèses.",
    folders: [
      DOCUMENTATION_FOLDER,
      "Sources collectées",
      "Notes de lecture",
      "Synthèses",
    ],
    skills: [...PROJECT_BASE_SKILLS],
    instructions:
      "Cite toujours tes sources (fichier ou lien). Distingue ce qui vient des documents de ce qui vient du web.",
  },
  {
    id: "communication",
    name: "Communication / événement",
    description:
      "Préparer une communication ou un événement : messages, supports, visuels, calendrier.",
    folders: [
      DOCUMENTATION_FOLDER,
      "Messages et éléments de langage",
      "Supports",
      "Visuels",
      "Calendrier et logistique",
    ],
    skills: [...PROJECT_BASE_SKILLS, "charte-canope", "diaporama-web"],
    instructions:
      "Respecte la charte graphique présente dans « Documentation ». Propose des formulations courtes et accessibles.",
  },
];

export function getProjectTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}
