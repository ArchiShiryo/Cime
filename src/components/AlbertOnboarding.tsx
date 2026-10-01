import { useState, type FormEvent } from "react";
import { Loader2, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAlbert } from "@/hooks/useAlbert";
import { ipc } from "@/ipc/types";
// @ts-ignore
import logo from "../../assets/logo.svg";

const ALBERT_KEY_HELP_URL = "https://albert.sites.beta.gouv.fr/";

/**
 * First-run screen: the only thing a user has to do is paste their Albert key.
 * The typed value is kept on every error so a network hiccup never costs them
 * their input.
 */
export function AlbertOnboarding({ onSkip }: { onSkip: () => void }) {
  const { connect } = useAlbert();
  const [apiKey, setApiKey] = useState("");
  const [connected, setConnected] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!apiKey.trim() || connect.isPending) return;
    try {
      await connect.mutateAsync(apiKey);
      setConnected(true);
    } catch {
      // The message is rendered from connect.error below; keep the input.
    }
  };

  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      data-testid="albert-onboarding"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-5 rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="size-10" />
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              Connecter Albert
            </h1>
            <p className="text-sm text-muted-foreground">
              Entrez votre clé API Albert pour commencer.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="albert-api-key">Clé API Albert</Label>
          <Input
            id="albert-api-key"
            data-testid="albert-api-key-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={connect.isPending || connected}
          />
        </div>

        {connect.error && (
          <p
            role="alert"
            data-testid="albert-error"
            className="whitespace-pre-line text-sm text-destructive"
          >
            {connect.error.message}
          </p>
        )}
        {connected && (
          <p className="flex items-center gap-2 text-sm text-primary">
            <CircleCheck size={16} /> Albert est connecté.
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!apiKey.trim() || connect.isPending || connected}
          data-testid="albert-connect-button"
        >
          {connect.isPending && (
            <Loader2 className="mr-2 size-4 animate-spin" />
          )}
          Connecter
        </Button>

        <div className="flex justify-between text-xs text-muted-foreground">
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => ipc.system.openExternalUrl(ALBERT_KEY_HELP_URL)}
          >
            Où trouver ma clé ?
          </button>
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={onSkip}
          >
            Utiliser un autre fournisseur
          </button>
        </div>
      </form>
    </div>
  );
}
