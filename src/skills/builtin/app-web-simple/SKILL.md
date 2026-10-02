---
name: app-web-simple
description: Conventions for generating in Cimes simple, robust web applications that are easy for non-developers to maintain (structure, state, validation, final checks). To use when the user asks to create or extend a small application.
---

# Simple web application

## Principles

- The smallest possible number of files and dependencies; no library added without a written reason.
- One page = one clear task. Interface in French, texts in a single place.
- Local data (`localStorage`) as long as no server is requested; provide JSON export/import of the data.
- Validate inputs, display understandable error messages, never a blank screen.

## Before handing over

1. Run the available type checking / build and fix the errors.
2. Review the application in the preview: the main journey works from start to finish.
3. Check that no secret (API key) is written in the code.
4. Summarise in 3 lines maximum what was done and how to use it.

For visual identity, use the `charte-canope` skill; for accessibility, `accessibilite-rgaa`.
