import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const hook = vi.hoisted(() => ({
  sources: [{ id: 1 }] as { id: number }[],
  search: {
    mutate: vi.fn(),
    data: undefined as undefined | unknown[],
    isPending: false,
    isError: false,
    error: null,
  },
}));

vi.mock("@/hooks/useKnowledge", () => ({
  useKnowledge: () => ({ sources: hook.sources, search: hook.search }),
}));

import { KnowledgeSearchBox } from "./KnowledgeSearchBox";

describe("KnowledgeSearchBox", () => {
  it("is disabled until a document has been added", () => {
    hook.sources = [];
    render(<KnowledgeSearchBox />);
    expect(screen.getByRole("button", { name: "Chercher" })).toBeDisabled();
    hook.sources = [{ id: 1 }];
  });

  it("runs the search on Enter and shows the passages with their source", () => {
    hook.search.data = [
      {
        source: "reglement.pdf",
        location: "p. 2",
        text: "Rendre avant 16h30.",
        score: 0.1,
      },
    ];
    render(<KnowledgeSearchBox />);
    const input = screen.getByPlaceholderText(/tablettes/);
    fireEvent.change(input, { target: { value: "tablettes" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(hook.search.mutate).toHaveBeenCalledWith("tablettes");
    expect(screen.getByText("Rendre avant 16h30.")).toBeInTheDocument();
    expect(screen.getByText(/reglement\.pdf · p\. 2/)).toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    hook.search.data = [];
    render(<KnowledgeSearchBox />);
    expect(screen.getByText(/Aucun extrait trouvé/)).toBeInTheDocument();
  });
});
