---
name: accessibilite-rgaa
description: Accessibility checklist (RGAA / WCAG) to apply to generated pages and applications: contrasts, keyboard, labels, ARIA, images. To use for any interface intended for a broad or institutional audience.
---

# Accessibility (RGAA)

Before finishing an interface, check:

1. **Structure**: a single `<h1>`, hierarchical headings, landmarks (`header`, `nav`, `main`, `footer`), `lang="fr"` attribute on `<html>`.
2. **Contrasts**: normal text ≥ 4.5:1, large text and components ≥ 3:1. Never convey information through colour alone.
3. **Keyboard**: everything is usable with the keyboard, logical tab order, visible focus (do not use `outline: none` without a replacement).
4. **Forms**: each field has an associated `<label>`, errors are written in text and linked to the field (`aria-describedby`).
5. **Images**: useful `alt`, `alt=""` if decorative. No text inside images.
6. **Dynamic components**: prefer native elements (`button`, `a`, `dialog`); only use ARIA when necessary.
7. **Motion**: respect `prefers-reduced-motion`; no flashing content.
8. **Zoom**: the interface remains usable at 200%; relative units (`rem`).

In the final answer, mention the points checked and those that still need to be checked manually.
