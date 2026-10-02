---
name: deboguer-methodiquement
description: Step-by-step method for diagnosing and fixing a bug or error in an application (blank page, build error, feature that doesn't work). Use as soon as a problem is reported or a check fails.
---

# Debug methodically

1. **Reproduce**: write down precisely what is expected and what actually happens. Read the application logs (log-reading tool) and the full error message, without assuming what it means.
2. **Locate**: walk back up the call stack to the first file in the project; read that file and its neighbours before changing anything.
3. **One hypothesis at a time**: state the likely cause, verify it (read the code, add a temporary `console.log`), and only then fix it.
4. **Fix at the root**, not the symptom; change as few lines as possible.
5. **Verify**: re-run the type check / the build / the preview and go through the path that was failing again. Do not declare it "fixed" without having seen it.
6. **Clean up**: remove the debugging traces.
7. **Stuck after two attempts**: stop, summarise for the user what is established and what remains unknown, suggest leads. Do not pile up patches or rewrite the whole project.
