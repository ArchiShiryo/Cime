import accessibiliteRgaa from "./accessibilite-rgaa/SKILL.md?raw";
import accompagnerUnAtelierIa from "./accompagner-un-atelier-ia/SKILL.md?raw";
import appWebSimple from "./app-web-simple/SKILL.md?raw";
import applicationHorsLigne from "./application-hors-ligne/SKILL.md?raw";
import atelierPedagogique from "./atelier-pedagogique/SKILL.md?raw";
import charteCanope from "./charte-canope/SKILL.md?raw";
import creerUnSkill from "./creer-un-skill/SKILL.md?raw";
import deboguerMethodiquement from "./deboguer-methodiquement/SKILL.md?raw";
import diaporamaWeb from "./diaporama-web/SKILL.md?raw";
import donneesElevesRgpd from "./donnees-eleves-rgpd/SKILL.md?raw";
import ficheImprimableA4 from "./fiche-imprimable-a4/SKILL.md?raw";
import formulaireEtCollecteDeDonnees from "./formulaire-et-collecte-de-donnees/SKILL.md?raw";
import interfaceClaireEnFrancais from "./interface-claire-en-francais/SKILL.md?raw";
import pageAdapteeMobile from "./page-adaptee-mobile/SKILL.md?raw";
import planifierAvantDeCoder from "./planifier-avant-de-coder/SKILL.md?raw";
import quizEtJeuxPedagogiques from "./quiz-et-jeux-pedagogiques/SKILL.md?raw";
import rechercheWebSourcee from "./recherche-web-sourcee/SKILL.md?raw";
import securiteApplicationWeb from "./securite-application-web/SKILL.md?raw";
import tableauDeBordEtGraphiques from "./tableau-de-bord-et-graphiques/SKILL.md?raw";
import { parseSkillMd, type ParsedSkill } from "../parse";

const RAW_BUILTIN_SKILLS: Record<string, string> = {
  "accessibilite-rgaa": accessibiliteRgaa,
  "accompagner-un-atelier-ia": accompagnerUnAtelierIa,
  "app-web-simple": appWebSimple,
  "application-hors-ligne": applicationHorsLigne,
  "atelier-pedagogique": atelierPedagogique,
  "charte-canope": charteCanope,
  "creer-un-skill": creerUnSkill,
  "deboguer-methodiquement": deboguerMethodiquement,
  "diaporama-web": diaporamaWeb,
  "donnees-eleves-rgpd": donneesElevesRgpd,
  "fiche-imprimable-a4": ficheImprimableA4,
  "formulaire-et-collecte-de-donnees": formulaireEtCollecteDeDonnees,
  "interface-claire-en-francais": interfaceClaireEnFrancais,
  "page-adaptee-mobile": pageAdapteeMobile,
  "planifier-avant-de-coder": planifierAvantDeCoder,
  "quiz-et-jeux-pedagogiques": quizEtJeuxPedagogiques,
  "recherche-web-sourcee": rechercheWebSourcee,
  "securite-application-web": securiteApplicationWeb,
  "tableau-de-bord-et-graphiques": tableauDeBordEtGraphiques,
};

/** Single-file skills shipped inside the app (no folder on disk). */
export const BUILTIN_SKILLS: ParsedSkill[] = Object.entries(
  RAW_BUILTIN_SKILLS,
).flatMap(([dirName, raw]) => {
  const result = parseSkillMd(raw, dirName);
  return result.ok ? [result.skill] : [];
});
