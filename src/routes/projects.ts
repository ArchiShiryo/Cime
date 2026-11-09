import { Route, createRoute } from "@tanstack/react-router";
import { z } from "zod";
import ProjectsPage from "../pages/projects";
import ProjectDetailsPage from "../pages/project-details";
import { rootRoute } from "./root";

export const projectsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});

export const projectDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/project",
  component: ProjectDetailsPage,
  validateSearch: z.object({ appId: z.number() }),
});
