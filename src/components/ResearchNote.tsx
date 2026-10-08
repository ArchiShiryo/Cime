import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ipc } from "@/ipc/types";
import { RESEARCH_SOURCES, type ResearchNoteId } from "@/shared/research_notes";

/** Discreet "why this approach" note: a short text and links to the papers. */
export function ResearchNote({ id }: { id: ResearchNoteId }) {
  const { t } = useTranslation("cimes");
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("research.label")}
        title={t("research.label")}
        data-testid={`research-note-${id}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
      >
        <BookOpen className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 text-sm">
        <p className="font-medium">{t(`research.${id}.title`)}</p>
        <p className="text-muted-foreground">{t(`research.${id}.text`)}</p>
        <ul className="space-y-1.5 border-t pt-2">
          {RESEARCH_SOURCES[id].map((source) => (
            <li key={source.url}>
              <button
                type="button"
                onClick={() => ipc.system.openExternalUrl(source.url)}
                className="text-left text-xs text-primary hover:underline"
              >
                {source.title}
              </button>
              <span className="block text-xs text-muted-foreground">
                {source.authors}, {source.year}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
