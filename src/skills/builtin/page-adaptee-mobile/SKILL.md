---
name: page-adaptee-mobile
description: Makes a web interface usable on phone, tablet and large screens (fluid layout, touch targets, readability). Use when an application will be viewed on a variety of devices or projected.
---

# An interface that adapts to every screen

- `<meta name="viewport" content="width=device-width, initial-scale=1">` is mandatory.
- Design **for the phone first** (a single column), then enhance with `@media (min-width: …)` at 640 px and 1024 px.
- Lay out with Flexbox/Grid and relative units (`rem`, `%`, `clamp()`), never fixed pixel widths for containers.
- Touch targets ≥ 44 × 44 px with sufficient spacing; no action that only works on hover.
- Text ≥ 16 px (otherwise the phone zooms in on form fields); images `max-width: 100%`.
- Wide tables: a horizontally scrollable container or a card layout on small screens.
- Test at 360 px, 768 px and 1280 px wide, and at 200 % zoom.
