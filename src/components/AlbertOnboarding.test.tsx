import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlbertOnboarding } from "./AlbertOnboarding";
import { AlbertSettings } from "./AlbertSettings";

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  connect: vi.fn(),
  testConnection: vi.fn(),
  disconnect: vi.fn(),
  openExternalUrl: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/ipc/types", () => ({
  ipc: {
    albert: {
      getStatus: mocks.getStatus,
      connect: mocks.connect,
      testConnection: mocks.testConnection,
      disconnect: mocks.disconnect,
    },
    system: { openExternalUrl: mocks.openExternalUrl },
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const CONNECTED = {
  connected: true,
  modelDisplayName: "DeepSeek V4 Flash - Albert",
  fromEnvironment: false,
};
const DISCONNECTED = { ...CONNECTED, connected: false };

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getStatus.mockResolvedValue(DISCONNECTED);
});

describe("AlbertOnboarding", () => {
  it("asks only for the API key", () => {
    renderWithClient(<AlbertOnboarding onSkip={vi.fn()} />);
    expect(screen.getByText("Connecter Albert")).toBeInTheDocument();
    expect(
      screen.getByText("Entrez votre clé API Albert pour commencer."),
    ).toBeInTheDocument();
    const input = screen.getByLabelText("Clé API Albert");
    expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Connecter" })).toBeDisabled();
  });

  it("connects with the typed key and confirms", async () => {
    mocks.connect.mockResolvedValue(CONNECTED);
    renderWithClient(<AlbertOnboarding onSkip={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Clé API Albert"), "sk-abc");
    await userEvent.click(screen.getByRole("button", { name: "Connecter" }));
    await waitFor(() =>
      expect(mocks.connect).toHaveBeenCalledWith({ apiKey: "sk-abc" }),
    );
    expect(await screen.findByText("Albert est connecté.")).toBeInTheDocument();
  });

  it("shows the error and keeps the typed key so it can be fixed", async () => {
    mocks.connect.mockRejectedValue(
      new Error(
        "Cette clé Albert n'est pas valide.\nVérifiez-la puis réessayez.",
      ),
    );
    renderWithClient(<AlbertOnboarding onSkip={vi.fn()} />);
    const input = screen.getByLabelText("Clé API Albert");
    await userEvent.type(input, "sk-bad");
    await userEvent.click(screen.getByRole("button", { name: "Connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cette clé Albert n'est pas valide.",
    );
    expect(input).toHaveValue("sk-bad");
    expect(input).toBeEnabled();
    expect(screen.getByRole("button", { name: "Connecter" })).toBeEnabled();
  });

  it("lets the user skip to another provider and open the key help", async () => {
    const onSkip = vi.fn();
    renderWithClient(<AlbertOnboarding onSkip={onSkip} />);
    await userEvent.click(screen.getByText("Où trouver ma clé ?"));
    expect(mocks.openExternalUrl).toHaveBeenCalled();
    await userEvent.click(screen.getByText("Utiliser un autre fournisseur"));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe("AlbertSettings", () => {
  it("shows the connected state without revealing a key", async () => {
    mocks.getStatus.mockResolvedValue(CONNECTED);
    renderWithClient(<AlbertSettings />);
    expect(await screen.findByText(/● Connecté/)).toBeInTheDocument();
    expect(screen.getByText(/DeepSeek V4 Flash - Albert/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Clé API Albert")).toBeNull();
  });

  it("tests the connection and reports success or failure", async () => {
    mocks.getStatus.mockResolvedValue(CONNECTED);
    mocks.testConnection.mockResolvedValueOnce({ ok: true });
    renderWithClient(<AlbertSettings />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Tester la connexion" }),
    );
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Albert est connecté."),
    );

    mocks.testConnection.mockRejectedValueOnce(
      new Error("Impossible de joindre Albert."),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Tester la connexion" }),
    );
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Impossible de joindre Albert.",
      ),
    );
  });

  it("changes the key through a masked input", async () => {
    mocks.getStatus.mockResolvedValue(CONNECTED);
    mocks.connect.mockResolvedValue(CONNECTED);
    renderWithClient(<AlbertSettings />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Modifier la clé" }),
    );
    const input = screen.getByPlaceholderText("Clé API Albert");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.type(input, "sk-new");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(mocks.connect).toHaveBeenCalledWith({ apiKey: "sk-new" }),
    );
  });

  it("offers to connect when disconnected and disconnects when connected", async () => {
    renderWithClient(<AlbertSettings />);
    expect(await screen.findByText(/○ Non connecté/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Connecter Albert" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tester la connexion" }),
    ).toBeNull();
  });

  it("disconnects on request", async () => {
    mocks.getStatus.mockResolvedValue(CONNECTED);
    mocks.disconnect.mockResolvedValue(DISCONNECTED);
    renderWithClient(<AlbertSettings />);
    await userEvent.click(
      await screen.findByRole("button", { name: "Déconnecter Albert" }),
    );
    await waitFor(() => expect(mocks.disconnect).toHaveBeenCalled());
  });
});
