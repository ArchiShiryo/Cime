import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResearchNote } from "./ResearchNote";
import { RESEARCH_SOURCES } from "@/shared/research_notes";
import i18n from "@/i18n";

const mocks = vi.hoisted(() => ({ openExternalUrl: vi.fn() }));
vi.mock("@/ipc/types", () => ({
  ipc: { system: { openExternalUrl: mocks.openExternalUrl } },
}));

describe("ResearchNote", () => {
  it("shows a short note and opens the sources", async () => {
    await i18n.changeLanguage("fr");
    render(<ResearchNote id="projects" />);
    await userEvent.click(screen.getByTestId("research-note-projects"));
    expect(
      await screen.findByText("Pourquoi les projets fonctionnent ainsi"),
    ).toBeInTheDocument();
    const first = RESEARCH_SOURCES.projects[0];
    await userEvent.click(screen.getByText(first.title));
    expect(mocks.openExternalUrl).toHaveBeenCalledWith(first.url);
  });

  it("only links to arXiv", () => {
    for (const list of Object.values(RESEARCH_SOURCES)) {
      for (const source of list) {
        expect(source.url).toMatch(/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{5}$/);
      }
    }
  });
});
