import { Route } from "@tanstack/react-router";
import DocumentsPage from "../pages/documents";
import { rootRoute } from "./root";

export const documentsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});
