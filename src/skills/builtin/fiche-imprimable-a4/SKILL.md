---
name: fiche-imprimable-a4
description: Creates web pages intended for A4 or A5 printing (worksheets, certificates, schedules, posters) with reliable CSS layout. Use for any document that will be printed or exported to PDF from the browser.
---

# Printable sheet

- Use `@page { size: A4; margin: 15mm; }` (or `A5`) and `@media print`; hide buttons and navigation when printing.
- Physical units (`mm`, `pt`) for templates; `break-inside: avoid` on blocks that must not be split, `break-after: page` to force a page break.
- Colours: provide a version that stays legible in black and white; add `print-color-adjust: exact` only for essential backgrounds.
- Body text 10–11 pt, hierarchically structured headings, margins large enough for hole punching (20 mm on the left for a binder).
- Fields to be filled in by hand: lines at least 8 mm high, checkboxes 5 mm.
- "Imprimer" button (`window.print()`) visible on screen only.
- Check the print preview: no content cut off, page numbers if there are several pages.
- Visual identity: `charte-canope`.
