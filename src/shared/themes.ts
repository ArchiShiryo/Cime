export interface Theme {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt: string;
}

export const DEFAULT_THEME_ID = "default";

const DEFAULT_THEME_PROMPT = `
<theme>
Any instruction in this theme should override other instructions if there's a contradiction.
### Default Theme
<rules>
All the rules are critical and must be strictly followed, otherwise it's a failure state.
#### Core Principles
- This is the default theme used by Dyad users, so it is important to create websites that leave a good impression.
- AESTHETICS ARE VERY IMPORTANT. All web apps should LOOK AMAZING and have GREAT FUNCTIONALITY!
- You are expected to deliver interfaces that balance creativity and functionality.
#### Component Guidelines
- Never ship default shadcn components — every component must be customized in style, spacing, and behavior.
- Always prefer rounded shapes.
#### Typography
- Type should actively shape the interface's character, not fade into neutrality.
#### Color System
- Establish a clear and confident color system.
- Centralize colors through variables to maintain consistency.
- Avoid using gradient backgrounds.
- Avoid using black as the primary color. Aim for colorful websites.
#### Motion & Interaction
- Apply motion with restraint and purpose.
- A small number of carefully composed sequences (like a coordinated entrance with delayed elements) creates more impact than numerous minor effects.
- Motion should clarify structure and intent, not act as decoration.
#### Visual Content
- Visuals are essential: Use images to create mood, context, and appeal.
- Don't build text-only walls.
#### Contrast Guidelines
Never use closely matched colors for an element's background and its foreground content. Insufficient contrast reduces readability and degrades the overall user experience.
**Bad Examples:**
- Light gray text (#B0B0B0) on a white background (#FFFFFF)
- Dark blue text (#1A1A4E) on a black background (#000000)
- Pale yellow button (#FFF9C4) with white text (#FFFFFF)
**Good Examples:**
- Dark charcoal text (#333333) on a white or light gray background
- White or light cream text (#FFFDF5) on a deep navy or dark background (#1A1A2E)
- Vibrant accent button (#6366F1) with white text for clear call-to-action visibility
### Layout structure
- ALWAYS design mobile-first, then enhance for larger screens.
</rules>
<workflow>
Follow this workflow when building web apps:
1. **Determine Design Direction**
   - Analyze the industry and target users of the website.
   - Define colors, fonts, mood, and visual style (you are allowed to ask the user if you have access to planning_questionnaire tool).
   - Ensure the design direction does NOT contradict the rules defined for this theme.
2. **Build the Application**
   - Do not neglect functionality in the pursuit of making a beautiful website.
   - You must achieve both great aesthetics AND great functionality.
</workflow>
</theme>`;

const CANOPE_THEME_PROMPT = `
<theme>
Any instruction in this theme should override other instructions if there's a contradiction.
### Réseau Canopé Theme
<rules>
All the rules are critical and must be strictly followed, otherwise it's a failure state.
#### Core Principles
- Institutional French public-education look (inspired by Réseau Canopé): sober, warm, trustworthy, highly readable.
- Interface copy is in French by default unless the user asks otherwise.
- Calm and pedagogical: clear hierarchy, generous whitespace, no visual noise.
#### Color System
Define these as CSS variables / Tailwind theme tokens and use them everywhere:
- Page background: warm pinkish beige #F4EFED
- Primary / headings / header & footer bands: deep turquoise #005A5B
- Text on beige: near-black #1A1A1A (never pure gray on beige)
- Text on turquoise: white #FFFFFF
- Pictograms / secondary icons / subtle dividers: grayed green #94A088
- Accent (sparingly, decorative shapes, highlights): magenta #C2185B
- Cards and inputs: white #FFFFFF on the beige background, with a 1px border of #94A088 at low opacity
- Never use default blue, orange or red Office-like colors. No gradient backgrounds. Avoid black as a primary color.
#### Typography
- Font stack: "Marianne", "Source Sans 3", system-ui, sans-serif (load Source Sans 3 from Google Fonts as the fallback).
- Headings: bold, turquoise #005A5B, left-aligned; page title around 28-32px, no decorative underline.
- Body text: 16px minimum, left-aligned, line-height 1.5-1.6. Center text only for pause/thank-you style screens.
#### Layout & Components
- Header: slim bar with the site/product name on the left and optional logo area on the right; footer: full-width turquoise band (#005A5B) with white 12px text such as the site URL.
- Keep a minimum horizontal margin of 1.25rem, content max-width around 72rem.
- Buttons: solid turquoise with white text, rounded-md, clear hover/focus states (visible focus ring); secondary buttons are outlined turquoise.
- Cards: white, rounded-lg, subtle border, light shadow at most. Customize shadcn components to this palette; never ship defaults.
- Lists: max 6 items per block; prefer cards or short sections over long text walls.
- Pictograms: simple line/flat icons in grayed green #94A088 (lucide icons are fine).
#### Accessibility
- Respect RGAA / WCAG AA contrast: turquoise on beige and white on turquoise are valid; never place #94A088 text on beige for essential content (use it for icons and decoration only).
- All interactive elements must be keyboard accessible with visible focus.
#### Motion
- Minimal and functional: short fades or 150-200ms transitions. No flashy animations.
### Layout structure
- ALWAYS design mobile-first, then enhance for larger screens.
</rules>
<workflow>
1. **Apply the institutional charter**
   - Set the CSS variables and fonts above first, before building any screen.
   - Build the shared header/footer layout once and reuse it on every page.
2. **Build the Application**
   - Do not neglect functionality: the charter shapes the look, the app must still work well.
   - Write all labels, buttons and messages in French.
</workflow>
</theme>`;

export const themesData: Theme[] = [
  {
    id: "default",
    name: "Default Theme",
    description:
      "Balanced design system emphasizing aesthetics, contrast, and functionality.",
    icon: "palette",
    prompt: DEFAULT_THEME_PROMPT,
  },
  {
    id: "canope",
    name: "Réseau Canopé",
    description:
      "Institutional French education style: warm beige background, deep turquoise, Marianne typography.",
    icon: "palette",
    prompt: CANOPE_THEME_PROMPT,
  },
];
