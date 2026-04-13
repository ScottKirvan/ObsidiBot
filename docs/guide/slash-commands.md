# Slash Commands

The `/` menu gives you quick access to built-in ObsidiBot actions and your own reusable prompt templates — all without leaving the chat panel.

## Opening the menu

**Toolbar button** — click the `/` button in the input toolbar. A menu opens with a search box. Type to filter, use arrow keys to navigate, Enter to execute, Escape to close.

**Inline trigger** — type `/` in the chat input, preceded by a space or at the start of the input (e.g. `summarize this /`). A compact menu appears above the input. Navigate with arrow keys, Enter executes, Escape or any other key dismisses it — the `/` stays as literal text so you can keep typing normally.

::: tip
`/` only triggers the menu when preceded by a space or at the start of the input. Typing `and/or` or `https://...` never opens the menu.
:::

## Built-in commands

| Category | Command | What it does |
|---|---|---|
| **Session** | New session | Start a fresh conversation |
| **Session** | Show history | Browse and resume past sessions |
| **Session** | Export session | Save the current session to your vault |
| **Context** | Attach file | Add a file, image, or URL to the prompt |
| **Context** | Open context file | Edit your persistent vault context |
| **Context** | Refresh context | Re-inject vault context into the session |
| **Context** | Open settings | Open ObsidiBot settings |

## Prompt templates

Create `.md` files in your commands folder and they appear in the `/` menu automatically. Selecting a template inserts its content into the input so you can review or edit before sending.

**Default folder:** `<plugin dir>/commands/` — this is inside the plugin directory and gitignored by default.

**Custom folder:** set **Settings → ObsidiBot → Commands folder** to any vault-relative path (e.g. `_commands`) or absolute path. Templates reload each time you open the menu, so changes take effect immediately.

### Template format

A template file can be plain text or include optional YAML frontmatter to set its category and description:

```markdown
---
category: Git
description: Write a commit message for staged changes
---
Review my staged git changes and write a conventional commit message following the Conventional Commits spec.
```

| Frontmatter field | Default | Description |
|---|---|---|
| `category` | `Prompts` | Groups templates under a named heading in the menu |
| `description` | *(none)* | Short subtitle shown below the command name |

Without frontmatter, the filename (minus `.md`) becomes the command name and it appears under **Prompts**.

### Examples

**`_commands/weekly-review.md`**
```markdown
---
category: Reviews
description: Structured weekly review
---
Review my notes from this week and give me a summary of:
- What I worked on
- Any open threads or unresolved questions
- Suggested priorities for next week
```

**`_commands/brainstorm.md`**
```
Let's brainstorm ideas about the following topic. Give me at least 10 diverse ideas, then help me evaluate the most promising ones.
```
