const fs = require("fs");
let s = fs.readFileSync("src/main.ts", "utf8");
s = s.replace(
  `// Register dyad-media:// protocol for serving persistent media attachments.`,
  `/** Interface language read straight from the settings file (before the app is ready). */
function readUiLanguageEarly(): "fr" | "en" {
  try {
    const raw = JSON.parse(
      fs.readFileSync(getSettingsFilePath(), "utf8"),
    ) as { language?: string };
    return raw.language === "en" ? "en" : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
const UI_LANGUAGE = readUiLanguageEarly();
// Chromium's own texts (context menu, spell-check menu) follow this switch.
app.commandLine.appendSwitch("lang", UI_LANGUAGE === "fr" ? "fr" : "en-US");

// Register dyad-media:// protocol for serving persistent media attachments.`,
);
s = s.replace(
  `      label: "Edit",
      submenu: [`,
  `      label: UI_LANGUAGE === "fr" ? "Édition" : "Edit",
      submenu: [`,
);
s = s.replace(
  `      label: "View",
      submenu: [
        {
          label: "Reload Dyad",`,
  `      label: UI_LANGUAGE === "fr" ? "Affichage" : "View",
      submenu: [
        {
          label: UI_LANGUAGE === "fr" ? "Recharger Cimes" : "Reload Cimes",`,
);
s = s.replace(
  `          label: "Force Reload Dyad",`,
  `          label:
            UI_LANGUAGE === "fr"
              ? "Forcer le rechargement"
              : "Force Reload Cimes",`,
);
s = s.replace(
  `      label: "Window",
      submenu: [`,
  `      label: UI_LANGUAGE === "fr" ? "Fenêtre" : "Window",
      submenu: [`,
);
s = s.replace(
  `label: \`Correct "\${params.misspelledWord}"\`,`,
  `label:
              UI_LANGUAGE === "fr"
                ? \`Corriger « \${params.misspelledWord} »\`
                : \`Correct "\${params.misspelledWord}"\`,`,
);
s = s.replace(
  `import { AUTO_UPDATE_AVAILABLE, DYAD_SERVICES_ENABLED } from "./shared/branding";`,
  `import {
  AUTO_UPDATE_AVAILABLE,
  DEFAULT_LANGUAGE,
  DYAD_SERVICES_ENABLED,
} from "./shared/branding";`,
);
fs.writeFileSync("src/main.ts", s);
