---
name: quiz-et-jeux-pedagogiques
description: Creates quizzes, memory games, flashcards and interactive exercises for the classroom or a workshop, with scoring and immediate feedback. Use when a game, a quiz, a self-grading exercise or a fun activity is requested.
---

# Quizzes and educational games

## Before coding

Specify (in a single grouped question if needed): audience and level, target concept, number of questions, use (individual, projected for a group, on a tablet).

## Content

- The questions live in **a single data file** (`questions.json` or an array at the top of the code), never in the HTML, so that the teacher can edit them without touching the interface.
- Each question: prompt, choices, correct answer, **short explanation** shown after the answer (immediate feedback is the pedagogical point).
- Shuffle the order of questions and choices on every run.

## Interface

- One question per screen, large buttons (finger-friendly), visible progress ("3 / 10").
- Final score with an encouraging message, a "Rejouer" (Play again) button and a "Revoir mes erreurs" (Review my mistakes) button.
- No stressful timer by default; the option must be switchable off.
- Works with keyboard and touch; compliant contrast (skill `accessibilite-rgaa`).

## Data

- Never store a pupil's name unless necessary; if a score is kept, it is stored locally (see `donnees-eleves-rgpd`).
