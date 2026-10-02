import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLoadApps } from "@/hooks/useLoadApps";
import { ipc } from "@/ipc/types";
import { queryKeys } from "@/lib/queryKeys";
import { showError } from "@/lib/toast";

/** Rename (display name only: the folder keeps its name) and delete a project. */
export function ProjectActions({
  appId,
  name,
  path,
}: {
  appId: number;
  name: string;
  path: string;
}) {
  const { t } = useTranslation("cimes");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshApps } = useLoadApps();
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [newName, setNewName] = useState(name);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDialog(null);
    setUnderstood(false);
    setBusy(false);
  };

  const rename = async () => {
    setBusy(true);
    try {
      await ipc.app.renameApp({
        appId,
        appName: newName.trim(),
        appPath: path,
      });
      await refreshApps();
      close();
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await ipc.app.deleteApp({ appId });
      await refreshApps();
      queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
      close();
      void navigate({ to: "/projects" });
    } catch (error) {
      showError(error);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          data-testid="project-rename"
          onClick={() => {
            setNewName(name);
            setDialog("rename");
          }}
        >
          {t("projects.rename")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="project-delete"
          onClick={() => setDialog("delete")}
        >
          {t("projects.delete")}
        </Button>
      </div>

      <Dialog
        open={dialog === "rename"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.renameTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            data-testid="project-rename-input"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              newName.trim() &&
              newName.trim() !== name &&
              void rename()
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("projects.renameHint")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {t("projects.cancel")}
            </Button>
            <Button
              disabled={busy || !newName.trim() || newName.trim() === name}
              data-testid="project-rename-confirm"
              onClick={() => void rename()}
            >
              {t("projects.rename")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.deleteTitle", { name })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{t("projects.deleteWarning")}</p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-primary"
              checked={understood}
              data-testid="project-delete-understood"
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            <span>{t("projects.deleteUnderstood")}</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {t("projects.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !understood}
              data-testid="project-delete-confirm"
              onClick={() => void remove()}
            >
              {t("projects.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Moves a conversation to another project. */
export function MoveChatDialog({
  chatId,
  fromAppId,
  open,
  onClose,
  onMoved,
}: {
  chatId: number | null;
  fromAppId: number;
  open: boolean;
  onClose: () => void;
  onMoved: () => void;
}) {
  const { t } = useTranslation("cimes");
  const { apps } = useLoadApps();
  const [busy, setBusy] = useState(false);
  const targets = apps.filter((app) => app.isProject && app.id !== fromAppId);

  const move = async (targetAppId: number) => {
    if (chatId === null) return;
    setBusy(true);
    try {
      await ipc.chat.moveChat({ chatId, targetAppId });
      onMoved();
      onClose();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("projects.moveTitle")}</DialogTitle>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("projects.moveNone")}
          </p>
        ) : (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {targets.map((target) => (
              <li key={target.id}>
                <button
                  type="button"
                  disabled={busy}
                  data-testid={`move-to-${target.name}`}
                  onClick={() => void move(target.id)}
                  className="w-full p-3 text-left hover:bg-accent disabled:opacity-50"
                >
                  {target.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {t("projects.moveHint")}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("projects.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
