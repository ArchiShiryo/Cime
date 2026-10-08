---
name: tableau-de-bord-et-graphiques
description: Turns data (CSV, entered table, results) into a readable and accessible dashboard and charts. Use when visualising, comparing or presenting figures.
---

# Dashboard and charts

- **Choose the form based on the question**: comparing categories → horizontal bars; change over time → line chart; part of a whole (≤ 5 parts) → stacked bar or donut; relationship between two numbers → scatter plot. Avoid 3D pie charts, dual axes and truncated axes.
- **Library**: hand-written SVG for a simple chart; otherwise a single lightweight library (Chart.js) already suited to the project.
- **Readability**: a title that states the message (e.g. « Les inscriptions ont doublé en mars » — "Sign-ups doubled in March"), units on the axes, values directly on the bars where possible, legend close to the data.
- **Colours**: Canopé palette (`charte-canope`), at most 5 distinct colours, never colour alone to distinguish (add a pattern, label or shape).
- **Accessibility**: text alternative for the chart (`role="img"` + `aria-label` or a visually hidden data table), contrast ≥ 3:1.
- **Import**: read a CSV chosen by the user (`<input type="file">`), detect `;` and `,`, flag invalid rows instead of crashing.
- **Print**: `@media print` stylesheet to export the dashboard to PDF from the browser.
