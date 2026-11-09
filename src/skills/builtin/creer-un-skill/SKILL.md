---
name: creer-un-skill
description: Helps write a new skill in the Claude format (a folder with a SKILL.md) that the user can import into Cimes. Use when the user wants to capture a method, a set of instructions or a style guide as a reusable skill.
---

# Creating a skill

A skill is a folder named after the skill, containing a `SKILL.md` file:

```
mon-skill/
  SKILL.md          (required)
  references/       (documents read on demand, optional)
  scripts/          (scripts, optional)
  assets/           (templates, images, optional)
```

## Approach

1. Ask **what the skill should make possible** and **in which situations it triggers**; collect one or two real examples.
2. Write the YAML header:
   ```
   ---
   name: lowercase-name-with-hyphens
   description: What the skill does AND when to use it (this text decides the triggering: be precise, 1 to 3 sentences).
   ---
   ```
3. Write the body in Markdown: instructions in the imperative, numbered steps, verification criteria. Stay under 500 lines; move details into `references/` and mention them ("see references/regles.md").
4. Only add a script if it brings real reliability; explain how to use it and never put a secret in it.
5. Create the folder in the application (`.cimes/skills/<name>/SKILL.md`) or provide it as a `.zip` to import in Settings > AI > Skills.
6. Test with a realistic request: is the skill listed, does it trigger, are the instructions enough?
