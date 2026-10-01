import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlbert } from "@/hooks/useAlbert";

export function AlbertSettings() {
  const { status, connect, testConnection, disconnect } = useAlbert();
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const connected = status?.connected ?? false;

  const save = async () => {
    try {
      await connect.mutateAsync(apiKey);
      setApiKey("");
      setEditing(false);
      toast.success("Albert est connecté.");
    } catch {
      // Error shown inline below; keep the input.
    }
  };

  const test = async () => {
    try {
      await testConnection.mutateAsync();
      toast.success("Albert est connecté.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-3" data-testid="albert-settings">
      <div className="text-sm">
        <div className="font-medium">Albert - DINUM</div>
        <div className="text-muted-foreground">
          État : {connected ? "● Connecté" : "○ Non connecté"}
          {status ? ` · Modèle : ${status.modelDisplayName}` : ""}
        </div>
        {status?.fromEnvironment && (
          <div className="text-xs text-muted-foreground">
            Clé fournie par la variable d&apos;environnement ALBERT_API_KEY.
          </div>
        )}
      </div>

      {editing && (
        <div className="space-y-2">
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Clé API Albert"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={connect.isPending}
          />
          {connect.error && (
            <p className="whitespace-pre-line text-sm text-destructive">
              {connect.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={save}
              disabled={!apiKey.trim() || connect.isPending}
            >
              {connect.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Enregistrer
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setApiKey("");
                connect.reset();
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          {connected && (
            <Button
              size="sm"
              variant="outline"
              onClick={test}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Tester la connexion
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {connected ? "Modifier la clé" : "Connecter Albert"}
          </Button>
          {connected && !status?.fromEnvironment && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              Déconnecter Albert
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
