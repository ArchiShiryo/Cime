---
name: traitement-par-lot
description: Apply the same task to many files at once (summarise 50 reports, extract dates from a folder of PDFs, classify documents, pull a field out of every form). Use when the user wants the same treatment for a whole folder instead of one document.
---

# Batch processing

The `batch_files` tool applies one instruction to every file of a folder, with a separate model call per file, and writes the results in a new folder. Originals are never modified.

## Before running

1. Ask for or confirm: the **input folder**, what to do with **each** file, and the **output folder** (suggest `Batch results/<short-name>`).
2. Check the size with the file tools (how many files, which types). Over 200 files: split by subfolder or extension.
3. **Test first** on 2 or 3 files copied into a small folder and show the user one result. Adjust the instruction, then run the whole folder. Each run is a new output folder (or the same folder with the same instruction to resume).
4. Say that it can take several minutes and uses many model calls.

## Writing a good instruction

- One precise task, same for every file: "List the decisions taken, with the date and the person in charge. If none, write: none."
- Name the exact fields wanted and the format ("one line per decision").
- Say what to do when information is missing ("not found").
- Do not mix several unrelated tasks in one batch.

## After the run

1. Read `summary.csv` in the output folder: it lists every file with `done` or `error` and the reason. Report failures clearly (scan too unclear, empty file, unsupported format).
2. To retry failures, call the tool again with the same output folder and the same instruction: only the missing or failed files are processed.
3. Spot-check 2 or 3 results against their source before presenting them as reliable. Very long documents are cut to their first part (marked in the summary): say so.
4. To gather everything into one table, read the result files and build it with the Office skill (for example a `.xlsx` with one row per file).
