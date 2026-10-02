---
name: charte-canope
description: Applies the Réseau Canopé graphic charter (colours, typography, tone) to an application or a web page. Use it as soon as the user mentions Canopé, charter, or visual identity, or wants an institutional look.
---

# Réseau Canopé Charter

## Colours

- Light background: `#F4EFED`
- Main turquoise (headings, buttons, links): `#005A5B`
- Secondary sage (accents, borders): `#94A088`
- Text: very dark grey (`#1F2A2A`), never pure black.
- Define these colours as CSS variables (`--canope-fond`, `--canope-turquoise`, `--canope-sauge`) and never repeat them as hard-coded values.

## Typography

- Heading font: Marianne if available, otherwise a legible sans-serif (Source Sans 3, system-ui).
- Body: 16 px minimum, line height 1.5.

## Tone and layout

- Clear French, short sentences, no jargon.
- Lots of space, slightly rounded corners, a single main action per screen.
- No purple, no garish gradients.
- The Canopé logo goes at the top left; do not distort or recolour it.

## Checks before handing off

1. Text/background contrast of at least 4.5:1 (see the `accessibilite-rgaa` skill).
2. The three colours are defined only once.
