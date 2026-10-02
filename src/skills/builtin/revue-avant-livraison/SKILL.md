---
name: revue-avant-livraison
description: Final proofreading checklist for an application before handing it back to the user (working order, errors, text, accessibility, security, backups). To be used at the end of any major app creation or modification.
---

# Review before delivery

Go through in order and fix whatever fails before answering:

1. **It starts**: type checking and the build pass; the preview displays with no error in the console or the logs.
2. **The main journey works** end to end, first with normal data, then with edge cases (empty field, very long text, accented characters, empty list).
3. **No leftovers from the build site**: no `TODO`, no debugging `console.log`, no placeholder text ("Lorem ipsum"), no forgotten dummy data.
4. **Text** in clear French, free of mistakes, consistent (`interface-claire-en-francais`).
5. **Basic accessibility**: keyboard, contrast, labels (`accessibilite-rgaa`).
6. **Security and data**: no key in the code, escaped input (`securite-application-web`), protected personal data (`donnees-eleves-rgpd`).
7. **Varied screens**: readable on a phone and when projected (`page-adaptee-mobile`).

## Final answer (5 lines maximum)

- What was done, in one sentence.
- How to use it (the first action to take).
- What was checked, and what could not be.
- The known limits or the decisions to be made.
