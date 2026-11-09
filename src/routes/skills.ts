import { Route } from "@tanstack/react-router";
import SkillsPage from "../pages/skills";
import { rootRoute } from "./root";

export const skillsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: SkillsPage,
});
