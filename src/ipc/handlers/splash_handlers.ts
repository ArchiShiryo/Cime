import { createTypedHandler } from "./base";
import { splashContracts } from "../types/splash";
import { notifyRendererReady } from "@/splash/splash_window";

export function registerSplashHandlers() {
  createTypedHandler(splashContracts.rendererReady, async () => {
    notifyRendererReady();
  });
}
