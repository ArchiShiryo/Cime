import type { WritingPreferences } from "@/lib/schemas";

const ADDRESS: Record<
  NonNullable<WritingPreferences["addressForm"]>,
  string
> = {
  formal: 'Address people formally (French "vous").',
  informal:
    'Address people informally (French "tu") when writing to colleagues or learners, unless the context calls for "vous".',
};
const REGISTER: Record<NonNullable<WritingPreferences["register"]>, string> = {
  administrative:
    "Register: administrative and institutional (precise, neutral, standard public-service wording and formulas).",
  educational:
    "Register: educational (clear, encouraging, concrete examples, short sentences).",
  plain: "Register: plain everyday language (simple words, direct, no jargon).",
};
const LENGTH: Record<NonNullable<WritingPreferences["length"]>, string> = {
  concise:
    "Length: keep answers and documents short; give the essentials first.",
  standard: "Length: balanced; develop only what the request needs.",
  detailed:
    "Length: thorough; explain the reasoning and cover the details and exceptions.",
};
const DOC_LANGUAGE: Record<
  Exclude<NonNullable<WritingPreferences["documentLanguage"]>, "auto">,
  string
> = {
  fr: "Write documents and messages in French, whatever language the request is in, unless asked otherwise.",
  en: "Write documents and messages in English, whatever language the request is in, unless asked otherwise.",
};

/** What the user said about how they want things written; empty when nothing is set. */
export function buildPreferencesPrompt(
  prefs: WritingPreferences | undefined,
): string {
  if (!prefs) return "";
  const lines: string[] = [];
  if (prefs.addressForm) lines.push(ADDRESS[prefs.addressForm]);
  if (prefs.register) lines.push(REGISTER[prefs.register]);
  if (prefs.length) lines.push(LENGTH[prefs.length]);
  if (prefs.documentLanguage && prefs.documentLanguage !== "auto") {
    lines.push(DOC_LANGUAGE[prefs.documentLanguage]);
  }
  const role = prefs.role?.trim();
  const service = prefs.service?.trim();
  if (role || service) {
    lines.push(
      `The user works ${service ? `in: ${service}` : ""}${role && service ? "; " : ""}${role ? `as: ${role}` : ""}. Use this as background; do not repeat it unless it is relevant.`,
    );
  }
  const signature = prefs.signature?.trim();
  if (signature) {
    lines.push(
      `Signature to put at the end of letters, emails and formal messages written for the user (keep its line breaks):\n${signature}`,
    );
  }
  if (lines.length === 0) return "";
  return `\n\n<user_preferences>\nThese are the user's own preferences for what you write for them. Follow them unless the user asks for something different in the conversation.\n${lines.map((l) => `- ${l}`).join("\n")}\n</user_preferences>`;
}
