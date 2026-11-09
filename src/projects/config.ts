import fs from "node:fs";
import path from "node:path";
import {
  DOCUMENTATION_FOLDER,
  getProjectTemplate,
  PROJECT_TEMPLATES,
  type ProjectTemplate,
} from "@/shared/project_templates";

export interface ProjectConfig {
  version: 1;
  templateId: string;
  /** Skills offered in this project's conversations. */
  enabledSkills: string[];
  /** Free guidance added to the assistant's instructions. */
  instructions: string;
}

const CONFIG_DIR = ".cimes";
const CONFIG_FILE = "project.json";

export function getProjectConfigPath(projectPath: string): string {
  return path.join(projectPath, CONFIG_DIR, CONFIG_FILE);
}

export function getDocumentationDir(projectPath: string): string {
  return path.join(projectPath, DOCUMENTATION_FOLDER);
}

export function readProjectConfig(projectPath: string): ProjectConfig | null {
  try {
    const raw = JSON.parse(
      fs.readFileSync(getProjectConfigPath(projectPath), "utf8"),
    ) as Partial<ProjectConfig>;
    if (!raw || typeof raw !== "object") return null;
    return {
      version: 1,
      templateId: typeof raw.templateId === "string" ? raw.templateId : "libre",
      enabledSkills: Array.isArray(raw.enabledSkills)
        ? raw.enabledSkills.filter((s): s is string => typeof s === "string")
        : [],
      instructions:
        typeof raw.instructions === "string" ? raw.instructions : "",
    };
  } catch {
    return null;
  }
}

export function isProjectPath(projectPath: string): boolean {
  return fs.existsSync(getProjectConfigPath(projectPath));
}

export function writeProjectConfig(
  projectPath: string,
  config: ProjectConfig,
): void {
  const file = getProjectConfigPath(projectPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function readmeFor(template: ProjectTemplate, name: string): string {
  const folders = template.folders.map((folder) => `- ${folder}`).join("\n");
  return `# ${name}\n\nProject created from the "${template.id}" template.\n\n## Layout\n\n${folders}\n\nPut reference documents in "${DOCUMENTATION_FOLDER}": the assistant can consult them once the RAG is created.\n`;
}

/** Creates the template's folders, README and project config inside `projectPath`. */
export function materializeProject(
  projectPath: string,
  templateId: string,
  name: string,
): ProjectConfig {
  const template =
    getProjectTemplate(templateId) ?? (PROJECT_TEMPLATES[0] as ProjectTemplate);
  fs.mkdirSync(projectPath, { recursive: true });
  for (const folder of template.folders) {
    fs.mkdirSync(path.join(projectPath, ...folder.split("/")), {
      recursive: true,
    });
  }
  fs.writeFileSync(
    path.join(projectPath, "README.md"),
    readmeFor(template, name),
    "utf8",
  );
  const config: ProjectConfig = {
    version: 1,
    templateId: template.id,
    enabledSkills: [...template.skills],
    instructions: template.instructions,
  };
  writeProjectConfig(projectPath, config);
  return config;
}

/** The assistant guidance for a project's conversations. */
export function buildProjectPrompt(
  config: ProjectConfig,
  name: string,
): string {
  const template = getProjectTemplate(config.templateId);
  const folders = template?.folders.map((folder) => `- ${folder}`).join("\n");
  return `<project>
You are helping with the project "${name}" (template: ${config.templateId}). The working directory is the project folder: every conversation of this project shares it. This is office and administrative work, not software development: produce documents (Word, Excel, PowerPoint, PDF, Markdown) and keep the folder tidy. Do not build web applications unless explicitly asked. Reply in the language the user writes in.
${folders ? `Folder layout:\n${folders}\n` : ""}Reference documents are in "${DOCUMENTATION_FOLDER}"; use \`search_docs\` to consult them, and cite the file.
${config.instructions ? `Project guidance: ${config.instructions}\n` : ""}</project>`;
}
