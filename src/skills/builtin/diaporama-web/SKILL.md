---
name: diaporama-web
description: Creates an HTML presentation slideshow (a single page, keyboard and touch navigation, fullscreen mode, PDF printing) with no external software. Use when slides or a browser-based presentation are requested.
---

# Web slideshow

- A single HTML page: each slide is a `<section>`; only one is visible at a time.
- Navigation: keyboard arrows, space, clicking on the sides, touch swipe; `F` for fullscreen; slide number in the address (`#3`) so you can return to a specific point.
- 16:9 layout that adapts to the screen (`vw`/`vh` or `clamp` units), text ≥ 28 px once projected, **one idea per slide**, 6 lines maximum.
- Printable version: `@media print` shows one slide per landscape page.
- Content in a JavaScript array or plain Markdown so the teacher can easily edit it.
- Canopé identity: `charte-canope`. Contrasts and reading order: `accessibilite-rgaa`.
- Do not use animations that hinder reading; respect `prefers-reduced-motion`.
