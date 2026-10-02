---
name: formulaire-et-collecte-de-donnees
description: Builds input forms, registration sheets or tracking tables with validation, local storage and CSV/JSON export. Use to collect, enter or track information (registrations, attendance, evaluations).
---

# Form and data collection

1. **Model**: list the fields (name, type, mandatory or not). One field = one question; no "au cas où" (just in case) field.
2. **Validate** on input and on submission: formats (email, date, number), error messages in French, linked to the field (`aria-describedby`), never a blocking alert.
3. **Store locally** (`localStorage` or IndexedDB) as long as no server is requested; offer **Exporter en CSV** (separator `;`, UTF-8 encoding with BOM for Excel) and **Importer/Exporter en JSON** for backup.
4. **Display** the data in a sortable/filterable table, with a confirmed delete button.
5. **Protect**: escape any entered text before display (never `innerHTML` with user input), limit lengths.
6. Warn that the data remains on this computer and explain how to back it up.

Personal data: apply `donnees-eleves-rgpd`.
