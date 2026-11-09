import path from "node:path";
import { shell } from "electron";
import { createTypedHandler } from "./base";
import { activityContracts } from "../types/activity";
import {
  clearActivity,
  getActivityLogPath,
  readActivity,
} from "@/activity/activity_log";

export function registerActivityHandlers() {
  createTypedHandler(activityContracts.list, async (_e, { errorsOnly }) => ({
    path: getActivityLogPath(),
    events: readActivity(400, { errorsOnly }),
  }));
  createTypedHandler(activityContracts.clear, async () => {
    clearActivity();
  });
  createTypedHandler(activityContracts.openFolder, async () => {
    await shell.openPath(path.dirname(getActivityLogPath()));
  });
}
